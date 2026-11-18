import type { Prisma } from "@prisma/client";

export type Category = { slug: string; label: string; icon: string; where: Prisma.ListingWhereInput };

export const CATEGORIES: Category[] = [
  { slug: "trending", label: "Trending", icon: "sparkles", where: {} },
  { slug: "cabins", label: "Cabins", icon: "cabin", where: { propertyType: { in: ["Cabin", "Chalet"] } } },
  { slug: "city", label: "City stays", icon: "city", where: { propertyType: { in: ["Apartment", "Loft", "Townhouse"] } } },
  { slug: "beach", label: "Beach", icon: "beach", where: { amenities: { hasSome: ["Beach access", "Ocean view", "Surfboards", "Waterfront"] } } },
  { slug: "pools", label: "Pools", icon: "pool", where: { amenities: { hasSome: ["Pool", "Plunge pool", "Stock-tank pool", "Hot tub"] } } },
  { slug: "countryside", label: "Countryside", icon: "countryside", where: { propertyType: { in: ["Farm stay", "Cottage", "Casita"] } } },
  { slug: "unique", label: "One of a kind", icon: "unique", where: { propertyType: { in: ["Treehouse", "Houseboat", "Camper/RV", "Ryokan"] } } },
  { slug: "views", label: "Amazing views", icon: "mountain", where: { amenities: { hasSome: ["Ocean view", "Mountain view", "River view", "Lake view"] } } },
  { slug: "cozy", label: "Cozy", icon: "fire", where: { amenities: { hasSome: ["Fireplace", "Wood stove", "Sauna"] } } },
  { slug: "homes", label: "Homes", icon: "door", where: { propertyType: { in: ["Entire home", "Bungalow", "Villa"] } } },
  { slug: "rooms", label: "Rooms", icon: "room", where: { propertyType: { in: ["Private room", "Guesthouse"] } } },
];

export function categoryBySlug(slug?: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
