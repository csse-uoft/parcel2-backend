import { Request, Response } from "express";

const HERE_API_URL = "https://geocode.search.hereapi.com/v1/geocode";

type FetchFn = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: any }) => Promise<any>;

const fetchFn: FetchFn | undefined = (globalThis as any).fetch;

function buildQueryParams(query: string, limit?: number) {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("lang", "en");
    if (Number.isFinite(limit) && typeof limit === "number" && limit > 0) {
        params.set("limit", String(Math.min(limit, 20)));
    } else {
        params.set("limit", "5");
    }
    return params;
}

function mapHereResult(item: any) {
    if (!item || typeof item !== "object") return null;
    const address = item.address ?? {};
    const position = item.position ?? {};
    const mapView = item.mapView ?? {};

    return {
        id: item.id ?? null,
        title: item.title ?? null,
        resultType: item.resultType ?? null,
        address: {
            label: address.label ?? null,
            houseNumber: address.houseNumber ?? null,
            street: address.street ?? null,
            district: address.district ?? null,
            city: address.city ?? null,
            county: address.county ?? null,
            state: address.state ?? null,
            stateCode: address.stateCode ?? null,
            postalCode: address.postalCode ?? null,
            countryName: address.countryName ?? null,
            countryCode: address.countryCode ?? null,
        },
        position: {
            lat: typeof position.lat === "number" ? position.lat : null,
            lng: typeof position.lng === "number" ? position.lng : null,
        },
        mapView: {
            west: typeof mapView.west === "number" ? mapView.west : null,
            south: typeof mapView.south === "number" ? mapView.south : null,
            east: typeof mapView.east === "number" ? mapView.east : null,
            north: typeof mapView.north === "number" ? mapView.north : null,
        },
        scoring: item.scoring ?? null,
    };
}

export async function searchAddress(req: Request, res: Response) {
    const query = (req.body?.query ?? req.body?.q ?? "").toString().trim();
    const limitRaw = req.body?.limit;
    const limit = typeof limitRaw === "number" ? limitRaw : undefined;

    if (!query) {
        res.status(400).json({ message: "query is required" });
        return;
    }

    const apiKey = process.env.HERE_API_KEY;
    if (!apiKey) {
        res.status(500).json({ message: "HERE_API_KEY is not configured" });
        return;
    }

    try {
        const params = buildQueryParams(query, limit);
        params.set("apiKey", apiKey);
        const url = `${HERE_API_URL}?${params.toString()}`;
        if (!fetchFn) {
            res.status(500).json({ message: "Fetch API is unavailable on this runtime" });
            return;
        }

        const response = await fetchFn(url);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("HERE API error", response.status, errorBody);
            res.status(502).json({ message: "Failed to fetch address suggestions" });
            return;
        }

        const payload = await response.json();
        const items = Array.isArray(payload?.items) ? payload.items.map(mapHereResult).filter(Boolean) : [];

        res.json({ items });
    } catch (error) {
        console.error("Error calling HERE Geocode API", error);
        res.status(500).json({ message: "Error fetching address suggestions" });
    }
}
