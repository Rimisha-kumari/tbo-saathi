"use client";
import { useCallback, useState } from "react";
import type { Booking, DisruptionResult, Flight, Hotel, Itinerary, LeadGuest, PendingAction } from "@/lib/types";
import type { WorkspaceTab } from "./useChat";

export interface CompareData {
  outbound: Flight[];
  ret: Flight[];
  hotels: Hotel[];
}

interface PlanData {
  itinerary: Itinerary;
  outboundOptions: Flight[];
  returnOptions: Flight[];
  hotelOptions: Hotel[];
}

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/travel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function useWorkspace() {
  const [tab, setTab] = useState<WorkspaceTab>("itinerary");
  const [compare, setCompare] = useState<CompareData>({ outbound: [], ret: [], hotels: [] });
  const [trip, setTrip] = useState<{ itinerary: Itinerary; booking: Booking | null } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingIds, setBookingIds] = useState<string[]>([]);
  const [disruptions, setDisruptions] = useState<Record<string, DisruptionResult>>({});

  const onTool = useCallback((name: string, data: unknown) => {
    switch (name) {
      case "planTrip": {
        const p = data as PlanData;
        setCompare({ outbound: p.outboundOptions, ret: p.returnOptions, hotels: p.hotelOptions });
        setTrip({ itinerary: p.itinerary, booking: null });
        setTab("itinerary");
        break;
      }
      case "searchFlights": {
        const d = data as Flight[] | { outbound: Flight[]; inbound: Flight[] };
        setCompare((c) => (Array.isArray(d) ? { ...c, outbound: d.slice(0, 3) } : { ...c, outbound: d.outbound.slice(0, 3), ret: d.inbound.slice(0, 3) }));
        setTab("compare");
        break;
      }
      case "searchHotels":
        setCompare((c) => ({ ...c, hotels: (data as Hotel[]).slice(0, 3) }));
        setTab("compare");
        break;
      case "updateItinerary":
      case "adjustTrip":
        setTab("itinerary");
        break;
      case "handleDisruption": {
        const d = data as DisruptionResult;
        setDisruptions((m) => ({ ...m, [d.bookingId]: d }));
        setTab("bookings");
        break;
      }
    }
  }, []);

  const refresh = useCallback(async (itineraryId: string | null, ids: string[]) => {
    const [t, b] = await Promise.all([
      itineraryId ? fetch(`/api/travel?op=itinerary&id=${encodeURIComponent(itineraryId)}`).then((r) => (r.ok ? r.json() : null)) : null,
      ids.length ? fetch(`/api/travel?op=bookings&ids=${ids.map(encodeURIComponent).join(",")}`).then((r) => (r.ok ? r.json() : [])) : [],
    ]);
    if (t) setTrip(t);
    setBookings(b as Booking[]);
  }, []);

  const addBookingId = useCallback((id: string) => setBookingIds((ids) => (ids.includes(id) ? ids : [...ids, id])), []);

  const confirm = useCallback((actionId: string, leadGuest: LeadGuest | null) => post<{ action: PendingAction; booking: Booking }>({ op: "confirm", actionId, leadGuest }), []);
  const discard = useCallback((actionId: string) => post<{ ok: true }>({ op: "discard", actionId }), []);
  const prepareCancel = useCallback((bookingId: string) => post<{ action: PendingAction }>({ op: "prepareCancel", bookingId }), []);
  const prepareRebook = useCallback((bookingId: string, optionIndex: number) => post<{ action: PendingAction }>({ op: "prepareRebook", bookingId, optionIndex }), []);
  const clearDisruption = useCallback((bookingId: string) => setDisruptions((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== bookingId))), []);

  return { tab, setTab, compare, trip, bookings, bookingIds, addBookingId, disruptions, clearDisruption, onTool, refresh, confirm, discard, prepareCancel, prepareRebook };
}

export type Workspace = ReturnType<typeof useWorkspace>;
