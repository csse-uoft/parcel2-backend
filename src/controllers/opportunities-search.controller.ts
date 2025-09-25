import type { Request, Response } from "express";
import { z } from "zod";
import { Opportunity } from "../models";

/* ---------------- zod schema ---------------- */

const BoundsSchema = z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
});

const CenterSchema = z.object({
    lat: z.number(),
    lng: z.number(),
});

const BodySchema = z.object({
    q: z.string().optional(),

    projectType: z.array(z.string()).optional(),        // IRIs
    projectStage: z.array(z.string()).optional(),       // IRIs
    partnershipRoles: z.array(z.string()).optional(),   // IRIs

    orgId: z.string().optional(),                       // partner org IRI

    posted: z.boolean().optional(),
    searchable: z.boolean().optional(),

    after: z.string().optional(), // ISO
    before: z.string().optional(),// ISO

    sortBy: z.enum(["datePosted", "dateModified", "name", "distance"]).default("dateModified"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // when true, return full hydrated objects (toJSON) + lat/lng
    showDetails: z.boolean().default(false),

    // geo
    bounds: BoundsSchema.optional(),
    center: CenterSchema.optional(),
    radiusKm: z.number().positive().max(20000).optional(),
});

type SortBy = z.infer<typeof BodySchema>["sortBy"];
type SortDir = z.infer<typeof BodySchema>["sortDir"];

type WithCoordinates = {
    op: any;
    lat?: number;
    lng?: number;
    _distanceKm?: number; // optional so both “with” and “without” distance fit this type
};

/* ---------------- controller ---------------- */

export async function searchOpportunities(req: Request, res: Response) {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid body", issues: parsed.error.flatten() });
        return;
    }
    const body = parsed.data;

    try {
        /* ----------- build where for OwlClass.find ----------- */
        const where: any = {};

        if (body.projectType?.length) where.projectType = { $in: body.projectType };
        if (body.projectStage?.length) where.projectStage = { $in: body.projectStage };
        if (body.partnershipRoles?.length) {
            where.partnershipRoles = { $in: body.partnershipRoles };
        }

        if (body.orgId) {
            // nested filter on Partner.organization (your builder should support nesting)
            where.partners = { organization: body.orgId };
        }

        // additionalInfo flags (be tolerant to boolean or string in store)
        const additionalInfo: any = {};
        if (typeof body.posted === "boolean") additionalInfo.isPosted = { $in: [body.posted, String(body.posted)] };
        if (typeof body.searchable === "boolean") additionalInfo.isSearchable = { $in: [body.searchable, String(body.searchable)] };
        if (Object.keys(additionalInfo).length) where.additionalInfo = additionalInfo;

        // Note: text query and date range will be applied after fetch (JS-side).
        const rows = await Opportunity.find(where);

        /* ----------- JS post-filtering ----------- */
        let filtered: any[] = rows;

        // q: contains on name/description (case-insensitive)
        if (body.q?.trim()) {
            const needle = body.q.toLowerCase();
            filtered = filtered.filter((r: any) => {
                const name = (r.name ?? "").toString().toLowerCase();
                const desc = (r.description ?? "").toString().toLowerCase();
                return name.includes(needle) || desc.includes(needle);
            });
        }

        // date range: prefer additionalInfo.dateModified, fallback to datePosted, then top-level
        const afterDate = toDate(body.after);
        const beforeDate = toDate(body.before);
        if (afterDate || beforeDate) {
            filtered = filtered.filter((r: any) => {
                const d =
                    r.additionalInfo?.dateModified ??
                    r.additionalInfo?.datePosted ??
                    r.dateModified ??
                    r.datePosted;
                if (!d) return false;
                const t = new Date(d).getTime();
                if (Number.isNaN(t)) return false;
                if (afterDate && t < afterDate.getTime()) return false;
                if (beforeDate && t > beforeDate.getTime()) return false;
                return true;
            });
        }

        /* ----------- geo filters (bounds / center+radius) ----------- */

        // extract coordinates once
        const withCoordinates: WithCoordinates[] = filtered.map((op: any) => {
            const { lat, lng } = extractLatLng(op);
            return { op, lat, lng };
        });

        let geoFiltered: WithCoordinates[] = withCoordinates;

        // bounding box filter
        if (body.bounds) {
            geoFiltered = geoFiltered.filter(x =>
                isFiniteNum(x.lat) &&
                isFiniteNum(x.lng) &&
                inBounds({ lat: x.lat!, lng: x.lng! }, body.bounds!)
            );
        }

        // center + radius filter (and compute distance for sorting)
        let distanceMap: Map<any, number> | undefined;
        if (body.center) {
            distanceMap = new Map();
            geoFiltered = geoFiltered.map(x => {
                const distance =
                    isFiniteNum(x.lat) && isFiniteNum(x.lng)
                        ? distanceKm(body.center!, { lat: x.lat!, lng: x.lng! })
                        : Number.POSITIVE_INFINITY;
                distanceMap!.set(x.op, distance);
                return { ...x, _distanceKm: distance } as WithCoordinates;
            });

            if (body.radiusKm) {
                geoFiltered = geoFiltered.filter(
                    x => (x._distanceKm ?? Number.POSITIVE_INFINITY) <= body.radiusKm!
                );
            }
        }

        filtered = geoFiltered.map(x => x.op);

        /* ----------- sorting ----------- */

        if (body.sortBy === "distance" && body.center) {
            filtered.sort((a: any, b: any) => {
                const da = (distanceMap?.get(a) ?? Number.POSITIVE_INFINITY);
                const db = (distanceMap?.get(b) ?? Number.POSITIVE_INFINITY);
                return body.sortDir === "asc" ? da - db : db - da;
            });
        } else {
            filtered.sort(makeComparator(body.sortBy, body.sortDir));
        }

        /* ----------- pagination ----------- */

        const total = filtered.length;
        const start = (body.page - 1) * body.pageSize;
        const pageItems = filtered.slice(start, start + body.pageSize);

        /* ----------- response shape ----------- */

        const items = body.showDetails
            ? pageItems.map((op: any) => {
                const { lat, lng } = extractLatLng(op);
                return { ...(op.toJSON?.() ?? op), lat, lng };
            })
            : pageItems.map((op: any) => {
                const { lat, lng } = extractLatLng(op);
                const ai = op.additionalInfo ?? {};
                const primary =
                    ai.primary_image ??
                    ai.primaryImage ??
                    (Array.isArray(ai.images) && ai.images.length ? ai.images[0] : undefined);

                return {
                    id: op.iri ?? op.id ?? op["@id"] ?? String(op._id ?? ""),
                    name: op.name,
                    description: op.description,
                    projectType: op.projectType,
                    projectStage: op.projectStage,
                    partnershipRoles: op.partnershipRoles ?? [],
                    primaryImage: primary,
                    images: ai.images ?? [],
                    files: ai.files ?? [],
                    datePosted: ai.datePosted ?? op.datePosted ?? null,
                    dateModified: ai.dateModified ?? op.dateModified ?? null,
                    partnersCount: Array.isArray(op.partners) ? op.partners.length : 0,
                    lat,
                    lng,
                };
            });

        res.json({
            items,
            total,
            page: body.page,
            pageSize: body.pageSize,
            hasMore: body.page * body.pageSize < total,
        });
    } catch (err: any) {
        console.error("searchOpportunities error", err);
        res.status(500).json({ message: err?.message ?? "Server error" });
    }
}

/* ---------------- helpers ---------------- */

function toDate(s?: string) {
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function makeComparator(sortBy: SortBy, sortDir: SortDir) {
    const dir = sortDir === "asc" ? 1 : -1;
    return (a: any, b: any) => {
        if (sortBy === "name") {
            const A = (a.name ?? "").toString().toLowerCase();
            const B = (b.name ?? "").toString().toLowerCase();
            if (A < B) return -1 * dir;
            if (A > B) return 1 * dir;
            return 0;
        }
        const aD =
            a.additionalInfo?.[sortBy] ??
            a[sortBy] ??
            a.additionalInfo?.dateModified ??
            a.additionalInfo?.datePosted ??
            a.dateModified ??
            a.datePosted ??
            null;
        const bD =
            b.additionalInfo?.[sortBy] ??
            b[sortBy] ??
            b.additionalInfo?.dateModified ??
            b.additionalInfo?.datePosted ??
            b.dateModified ??
            b.datePosted ??
            null;

        const at = aD ? new Date(aD).getTime() : 0;
        const bt = bD ? new Date(bD).getTime() : 0;

        // asc: older -> newer; desc: newer -> older
        return dir === 1 ? (at - bt) : (bt - at);
    };
}

/**
 * Pull the first available lat/lng from the Opportunity’s lands[] → address[].
 * Address latitude/longitude are strings in your model, so we parse to numbers.
 */
function extractLatLng(op: any): { lat?: number; lng?: number } {
    const land = op.land;
    const addresses: any[] = Array.isArray(land.addresses) ? land.addresses : [];
    for (const addr of addresses) {
        const latS = addr.latitude ?? addr.lat ?? addr.geoLat;
        const lngS = addr.longitude ?? addr.lng ?? addr.geoLng;
        const lat = toNum(latS);
        const lng = toNum(lngS);
        if (isFiniteNum(lat) && isFiniteNum(lng)) return { lat, lng };
    }
    return {};
}

function toNum(value: any): number | undefined {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function isFiniteNum(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}

/* geo helpers */

function deg2rad(d: number) {
    return d * Math.PI / 180;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const dLat = deg2rad(b.lat - a.lat);
    const dLng = deg2rad(b.lng - a.lng);
    const la1 = deg2rad(a.lat);
    const la2 = deg2rad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function inBounds(p: { lat: number; lng: number }, b: { north: number; south: number; east: number; west: number }) {
    const inLat = p.lat <= b.north && p.lat >= b.south;
    const inLng = b.west <= b.east ? (p.lng >= b.west && p.lng <= b.east) : (p.lng >= b.west || p.lng <= b.east);
    return inLat && inLng;
}
