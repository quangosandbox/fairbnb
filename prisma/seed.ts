/**
 * Demo dataset for Fairbnb.
 *
 *   npx prisma db seed      (or: npm run db:seed)
 *
 * Idempotent: every table is wiped (FK-safe order) and re-populated.
 * Deterministic: a seeded PRNG drives all "random" choices, so repeated runs
 * produce the same listings, dates and reviews (only cuid ids differ).
 *
 * Demo accounts (password for every seeded user is "password123"):
 *   host@fairbnb.test   — hosts several listings
 *   guest@fairbnb.test  — has past stays, reviews and an upcoming trip
 */
import { PrismaClient, BookingStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculatePrice } from "../src/lib/pricing";

const prisma = new PrismaClient();
const PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------
let rngState = 0x2f6e2b1;
function rand(): number {
  // mulberry32
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

// "Today" for the demo is whenever the seed runs; dates are UTC midnights.
const TODAY = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
})();
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const photoUrl = (seed: string) => `https://picsum.photos/seed/${seed}/1200/800`;
const avatarUrl = (seed: string) => `https://picsum.photos/seed/fairbnb-avatar-${seed}/256/256`;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
type SeedUser = { key: string; email: string; name: string; bio?: string };

const HOSTS: SeedUser[] = [
  {
    key: "demoHost",
    email: "host@fairbnb.test",
    name: "Maya Okafor",
    bio: "Former park ranger turned full-time host. I look after a handful of places in the Pacific Northwest and the desert Southwest, and I answer messages fast.",
  },
  {
    key: "rafael",
    email: "rafael.mendes@fairbnb.test",
    name: "Rafael Mendes",
    bio: "Architect in Lisbon. I restore old buildings and rent out the flats I can't bear to sell.",
  },
  {
    key: "yuki",
    email: "yuki.tanaka@fairbnb.test",
    name: "Yuki Tanaka",
    bio: "Third-generation innkeeper. Happy to recommend the noodle shops the guidebooks miss.",
  },
  {
    key: "sofia",
    email: "sofia.ramirez@fairbnb.test",
    name: "Sofía Ramírez",
    bio: "Ceramicist and surfer splitting time between Oaxaca and the Pacific coast.",
  },
  {
    key: "graham",
    email: "graham.lavoie@fairbnb.test",
    name: "Graham Lavoie",
    bio: "Carpenter. I built two of my cabins by hand and still split the firewood myself.",
  },
  {
    key: "chiara",
    email: "chiara.bellini@fairbnb.test",
    name: "Chiara Bellini",
    bio: "Food writer from Bologna. Every guest leaves with my grandmother's ragù recipe.",
  },
];

const GUESTS: SeedUser[] = [
  { key: "demoGuest", email: "guest@fairbnb.test", name: "Jordan Lee", bio: "Remote product designer. Slow traveler, coffee snob, always packing too many books." },
  { key: "priya", email: "priya.natarajan@fairbnb.test", name: "Priya Natarajan" },
  { key: "marcus", email: "marcus.bell@fairbnb.test", name: "Marcus Bell" },
  { key: "elena", email: "elena.petrova@fairbnb.test", name: "Elena Petrova" },
  { key: "tom", email: "tom.hughes@fairbnb.test", name: "Tom Hughes" },
  { key: "aisha", email: "aisha.karim@fairbnb.test", name: "Aisha Karim" },
  { key: "diego", email: "diego.alvarez@fairbnb.test", name: "Diego Álvarez" },
  { key: "hannah", email: "hannah.schultz@fairbnb.test", name: "Hannah Schultz" },
  { key: "kenji", email: "kenji.mori@fairbnb.test", name: "Kenji Mori" },
  { key: "olivia", email: "olivia.brennan@fairbnb.test", name: "Olivia Brennan" },
];

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
type SeedListing = {
  slug: string;
  host: string;
  title: string;
  description: string;
  propertyType: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  price: number; // dollars / night
  cleaning: number; // dollars
  taxBps: number;
  minNights: number;
  photoAlts: string[];
};

const L: SeedListing[] = [
  // ---- Maya (demo host) ---------------------------------------------------
  {
    slug: "portland-craftsman",
    host: "demoHost",
    title: "Sunlit Craftsman Bungalow Near Alberta Arts",
    description:
      "A 1912 bungalow with original fir floors, a deep front porch and a backyard fire pit under a big old maple. Walk ten minutes to galleries, taquerias and the Saturday street fair. The kitchen is properly stocked — cast iron, a good chef's knife, local coffee — and the guest room has blackout curtains for anyone sleeping off a red-eye.",
    propertyType: "Entire home",
    city: "Portland",
    region: "Oregon",
    country: "United States",
    lat: 45.559,
    lng: -122.6465,
    maxGuests: 5,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Washer", "Dryer", "Free parking on premises", "Fire pit", "Dedicated workspace", "Coffee maker", "Pets allowed", "Heating"],
    price: 165,
    cleaning: 75,
    taxBps: 1150,
    minNights: 2,
    photoAlts: ["Front porch with rocking chairs", "Living room with fireplace", "Kitchen with open shelving", "Primary bedroom", "Backyard fire pit"],
  },
  {
    slug: "seattle-houseboat",
    host: "demoHost",
    title: "Floating Studio on Lake Union",
    description:
      "Wake up to seaplanes and paddleboarders from a snug, light-filled houseboat moored on the east side of Lake Union. There's a rooftop deck for sunset, a kayak you're welcome to borrow, and a wood stove for drizzly evenings. Expect a gentle sway when the wakes roll in — most guests say it's the best sleep they've had.",
    propertyType: "Houseboat",
    city: "Seattle",
    region: "Washington",
    country: "United States",
    lat: 47.6345,
    lng: -122.3268,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchenette", "Rooftop deck", "Kayak", "Wood stove", "Waterfront", "Heating", "Coffee maker"],
    price: 210,
    cleaning: 60,
    taxBps: 1500,
    minNights: 2,
    photoAlts: ["Houseboat exterior at dusk", "Rooftop deck over the water", "Interior with wood stove", "Loft bed under skylight"],
  },
  {
    slug: "sedona-casita",
    host: "demoHost",
    title: "Red Rock Casita with Stargazing Patio",
    description:
      "An adobe casita tucked into the juniper on the edge of town, with an unobstructed view of Cathedral Rock from the patio. Sedona is a dark-sky community, so the Milky Way shows up most clear nights — there's a telescope in the closet. Trailheads are a five-minute drive; the outdoor shower is a five-second walk.",
    propertyType: "Casita",
    city: "Sedona",
    region: "Arizona",
    country: "United States",
    lat: 34.8697,
    lng: -111.761,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchenette", "Outdoor shower", "Patio", "Telescope", "Air conditioning", "Free parking on premises", "Mountain view"],
    price: 245,
    cleaning: 85,
    taxBps: 1290,
    minNights: 2,
    photoAlts: ["Adobe casita with red rocks behind", "Patio at sunset", "Bedroom with beehive fireplace", "Outdoor stone shower"],
  },
  {
    slug: "bend-aframe",
    host: "demoHost",
    title: "A-Frame Hideout Between Ski Hill and River",
    description:
      "A 1970s A-frame, lovingly updated, sitting on a quiet lot of ponderosa pines. In winter you're 25 minutes from the lifts with a boot dryer waiting; in summer you can float the Deschutes and be back for dinner on the deck. The sleeping loft is reached by a steep ladder — great for kids, less great after a third beer.",
    propertyType: "Cabin",
    city: "Bend",
    region: "Oregon",
    country: "United States",
    lat: 44.0582,
    lng: -121.3153,
    maxGuests: 6,
    bedrooms: 2,
    beds: 4,
    bathrooms: 1.5,
    amenities: ["Wifi", "Kitchen", "Hot tub", "Wood stove", "Boot dryer", "Free parking on premises", "Washer", "Dryer", "BBQ grill", "Board games"],
    price: 285,
    cleaning: 120,
    taxBps: 1040,
    minNights: 2,
    photoAlts: ["A-frame in snowy pines", "Great room with tall windows", "Sleeping loft", "Hot tub on the deck", "Kitchen and dining"],
  },
  {
    slug: "santa-fe-room",
    host: "demoHost",
    title: "Quiet Garden Room off Canyon Road",
    description:
      "A private bedroom and bath in my old adobe, with its own entrance through a walled garden of hollyhocks and apricot trees. You're a short stroll from Canyon Road's galleries and the Plaza. I'm usually around in the mornings and happy to share green chile breakfast burritos if you're up early.",
    propertyType: "Private room",
    city: "Santa Fe",
    region: "New Mexico",
    country: "United States",
    lat: 35.6826,
    lng: -105.9286,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Private entrance", "Private bathroom", "Garden", "Coffee maker", "Heating", "Air conditioning"],
    price: 98,
    cleaning: 30,
    taxBps: 1500,
    minNights: 1,
    photoAlts: ["Walled garden entrance", "Guest bedroom with kiva fireplace", "Private bathroom with Talavera tile"],
  },
  // ---- Graham (cabins, US + Canada) --------------------------------------
  {
    slug: "asheville-treehouse",
    host: "graham",
    title: "Hemlock Treehouse with Rope Bridge",
    description:
      "Twenty feet up in a stand of hemlocks, reached by a swaying rope bridge, this treehouse has a queen bed beneath a skylight, a screened porch and a composting toilet that's nicer than it sounds. A full bathhouse with hot shower is thirty steps away on the ground. Downtown Asheville's breweries are twenty minutes down the mountain.",
    propertyType: "Treehouse",
    city: "Asheville",
    region: "North Carolina",
    country: "United States",
    lat: 35.5951,
    lng: -82.5515,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Screened porch", "Fire pit", "Outdoor shower", "Coffee maker", "Hammock", "Free parking on premises"],
    price: 189,
    cleaning: 55,
    taxBps: 1300,
    minNights: 2,
    photoAlts: ["Treehouse among hemlocks", "Rope bridge entrance", "Bed under the skylight", "Screened porch at dawn"],
  },
  {
    slug: "gatlinburg-cabin",
    host: "graham",
    title: "Hand-Built Log Cabin at the Edge of the Smokies",
    description:
      "I built this cabin from white pine logs milled on the property. It sits on six wooded acres with a creek you can hear from the porch swing. Inside: a stone fireplace, a clawfoot tub and a big farmhouse table. It's a mile of gravel road from pavement, so a regular car is fine but take it slow.",
    propertyType: "Cabin",
    city: "Gatlinburg",
    region: "Tennessee",
    country: "United States",
    lat: 35.7143,
    lng: -83.5102,
    maxGuests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    amenities: ["Wifi", "Kitchen", "Fireplace", "Hot tub", "Porch swing", "Creek access", "Washer", "Dryer", "Free parking on premises", "BBQ grill"],
    price: 225,
    cleaning: 110,
    taxBps: 1275,
    minNights: 2,
    photoAlts: ["Log cabin in the woods", "Stone fireplace", "Farmhouse table", "Clawfoot tub", "Creek below the porch"],
  },
  {
    slug: "tofino-cabin",
    host: "graham",
    title: "Cedar Cabin Above Chesterman Beach",
    description:
      "A cedar-shingled cabin on a forested bluff, with a path straight down to one of the best surf beaches on the island. Storm-watching season is the real show: pull up a chair at the picture window and watch the swells roll in. Boards and wetsuits for rent in town; the wood-fired sauna is on us.",
    propertyType: "Cabin",
    city: "Tofino",
    region: "British Columbia",
    country: "Canada",
    lat: 49.1213,
    lng: -125.8885,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Sauna", "Beach access", "Wood stove", "Ocean view", "Outdoor shower", "Free parking on premises"],
    price: 260,
    cleaning: 90,
    taxBps: 1300,
    minNights: 3,
    photoAlts: ["Cedar cabin in the rainforest", "Picture window over the ocean", "Wood-fired sauna", "Path to the beach"],
  },
  {
    slug: "mont-tremblant-chalet",
    host: "graham",
    title: "Slopeside Chalet with Wood-Fired Hot Tub",
    description:
      "A timber chalet a short shuttle ride from the village, with a mudroom made for ski boots and a wood-fired hot tub that takes an hour to heat and is worth every minute. In autumn the maples around the lake go full fireworks. Sleeps a big family or two couples who like each other.",
    propertyType: "Chalet",
    city: "Mont-Tremblant",
    region: "Quebec",
    country: "Canada",
    lat: 46.1185,
    lng: -74.5962,
    maxGuests: 8,
    bedrooms: 4,
    beds: 5,
    bathrooms: 2.5,
    amenities: ["Wifi", "Kitchen", "Hot tub", "Fireplace", "Ski storage", "Washer", "Dryer", "Free parking on premises", "Lake view", "Board games"],
    price: 340,
    cleaning: 150,
    taxBps: 1498,
    minNights: 3,
    photoAlts: ["Chalet in winter", "Great room with stone hearth", "Wood-fired hot tub", "Bunk room", "Lake view in autumn"],
  },
  {
    slug: "banff-loft",
    host: "graham",
    title: "Mountain-View Loft Steps from Banff Avenue",
    description:
      "An open-plan loft above a quiet side street, with a wall of windows facing Cascade Mountain. Walk to the gondola shuttle, the hot springs bus and more bakeries than one town should have. Heated floors, a proper espresso machine and a drying rack for wet gear.",
    propertyType: "Apartment",
    city: "Banff",
    region: "Alberta",
    country: "Canada",
    lat: 51.1784,
    lng: -115.5708,
    maxGuests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Heated floors", "Espresso machine", "Mountain view", "Elevator", "Free parking on premises", "Washer"],
    price: 230,
    cleaning: 70,
    taxBps: 900,
    minNights: 2,
    photoAlts: ["Loft window framing Cascade Mountain", "Open kitchen", "Bedroom nook", "Street view at night"],
  },
  // ---- Sofía (Mexico + California coast) --------------------------------
  {
    slug: "oaxaca-courtyard",
    host: "sofia",
    title: "Courtyard House with Rooftop Mezcal Terrace",
    description:
      "A colonial-era house in Jalatlaco, the most walkable corner of Oaxaca City, built around a courtyard full of bougainvillea and a lemon tree. Up the tiled stairs is a rooftop terrace with views of the church domes — bring mezcal, watch the sunset turn everything pink. My ceramics studio is next door if you'd like a lesson.",
    propertyType: "Entire home",
    city: "Oaxaca",
    region: "Oaxaca",
    country: "Mexico",
    lat: 17.0654,
    lng: -96.7186,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    amenities: ["Wifi", "Kitchen", "Rooftop terrace", "Courtyard", "Washer", "Dedicated workspace", "Hot water"],
    price: 115,
    cleaning: 30,
    taxBps: 500,
    minNights: 2,
    photoAlts: ["Courtyard with bougainvillea", "Rooftop terrace at sunset", "Bedroom with hand-loomed bedding", "Tiled kitchen"],
  },
  {
    slug: "tulum-jungle",
    host: "sofia",
    title: "Jungle Casita Near the Cenotes",
    description:
      "A thatched-roof casita on a quiet jungle lot, ten minutes by bike from the beach and close to two swimmable cenotes. Mornings bring toucans and the occasional curious coati. There's a plunge pool, an outdoor kitchen and screens on every window. Power is solar with a backup — please go easy on the A/C.",
    propertyType: "Bungalow",
    city: "Tulum",
    region: "Quintana Roo",
    country: "Mexico",
    lat: 20.2114,
    lng: -87.4654,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Plunge pool", "Outdoor kitchen", "Bicycles", "Air conditioning", "Hammock", "Mosquito nets"],
    price: 155,
    cleaning: 40,
    taxBps: 600,
    minNights: 3,
    photoAlts: ["Thatched casita in the jungle", "Plunge pool", "Bed with mosquito net", "Outdoor kitchen"],
  },
  {
    slug: "mexico-city-roma",
    host: "sofia",
    title: "Art Deco Flat on a Leafy Street in Roma Norte",
    description:
      "High ceilings, herringbone parquet and tall windows over a jacaranda-lined street. You're surrounded by Mexico City's best cafés and taquerías, and a five-minute walk from Parque México. The building is from 1934, so the elevator is charming and slow. Fast fiber internet for anyone working remotely.",
    propertyType: "Apartment",
    city: "Mexico City",
    region: "CDMX",
    country: "Mexico",
    lat: 19.4194,
    lng: -99.1617,
    maxGuests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Dedicated workspace", "Elevator", "Washer", "Balcony", "Coffee maker"],
    price: 92,
    cleaning: 25,
    taxBps: 550,
    minNights: 2,
    photoAlts: ["Living room with tall windows", "Balcony over jacaranda trees", "Bedroom", "Workspace by the window"],
  },
  {
    slug: "sayulita-surf",
    host: "sofia",
    title: "Surf Shack with Hammocks, Two Blocks from the Break",
    description:
      "A breezy palapa-roofed bungalow with an open-air living room, hammocks and an outdoor shower for rinsing off sand. Sayulita's beginner-friendly break is two blocks away; boards are in the shed. Expect roosters at dawn and music from the plaza on weekends — it's part of the charm.",
    propertyType: "Bungalow",
    city: "Sayulita",
    region: "Nayarit",
    country: "Mexico",
    lat: 20.8689,
    lng: -105.4407,
    maxGuests: 4,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Surfboards", "Outdoor shower", "Hammock", "Ceiling fans", "Beach access"],
    price: 120,
    cleaning: 35,
    taxBps: 500,
    minNights: 3,
    photoAlts: ["Palapa bungalow", "Hammocks in the open-air living room", "Surfboards in the shed", "Bedroom with ceiling fan"],
  },
  {
    slug: "big-sur-cottage",
    host: "sofia",
    title: "Cliffside Cottage Above the Big Sur Coast",
    description:
      "A tiny redwood cottage on a ridge above Highway 1, where the fog rolls in below you most mornings. There is no TV and patchy cell service; there is a deep soaking tub with an ocean view and a library of field guides. Starlink Wi-Fi works for emails but not for streaming. Bring groceries — the nearest store is 30 minutes away.",
    propertyType: "Cottage",
    city: "Big Sur",
    region: "California",
    country: "United States",
    lat: 36.2704,
    lng: -121.8081,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Soaking tub", "Ocean view", "Fireplace", "Free parking on premises", "Hiking trails"],
    price: 395,
    cleaning: 95,
    taxBps: 1050,
    minNights: 2,
    photoAlts: ["Redwood cottage on the ridge", "Fog over the ocean", "Soaking tub with a view", "Reading nook by the fire"],
  },
  // ---- Rafael (Portugal + Spain-adjacent + US city) ----------------------
  {
    slug: "lisbon-alfama",
    host: "rafael",
    title: "Tiled Apartment with River Views in Alfama",
    description:
      "A restored top-floor flat in a 19th-century building, with blue-and-white azulejos, exposed stone walls and a little balcony looking over the rooftops to the Tagus. Tram 28 rattles past the corner. It's three flights up with no elevator — the view is the reward. I've left a hand-drawn map of my favorite tascas.",
    propertyType: "Apartment",
    city: "Lisbon",
    region: "Lisbon",
    country: "Portugal",
    lat: 38.7118,
    lng: -9.1303,
    maxGuests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Balcony", "River view", "Washer", "Coffee maker", "Hair dryer"],
    price: 125,
    cleaning: 40,
    taxBps: 400,
    minNights: 2,
    photoAlts: ["Balcony over Alfama rooftops", "Living room with azulejos", "Stone-walled bedroom", "Kitchen"],
  },
  {
    slug: "porto-ribeira",
    host: "rafael",
    title: "Riverside Loft Above the Ribeira",
    description:
      "A two-level loft in a narrow granite townhouse on the Douro, facing the port lodges across the water. Original chestnut beams, a spiral staircase and a window seat built for watching rabelo boats drift past. The neighborhood is lively until late on summer nights; earplugs are in the drawer.",
    propertyType: "Loft",
    city: "Porto",
    region: "Porto",
    country: "Portugal",
    lat: 41.1405,
    lng: -8.6131,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchenette", "River view", "Washer", "Air conditioning", "Coffee maker"],
    price: 110,
    cleaning: 35,
    taxBps: 300,
    minNights: 2,
    photoAlts: ["Window seat over the Douro", "Spiral staircase", "Bedroom under chestnut beams"],
  },
  {
    slug: "sintra-quinta",
    host: "rafael",
    title: "Garden Room in a Quinta Below the Palaces",
    description:
      "A private room with its own bath in a 1900s quinta, surrounded by camellias, ferns and a moss-covered fountain. The fairytale palaces of Sintra are a steep, beautiful 20-minute walk up the hill. Breakfast with orange cake from the bakery in the village is included.",
    propertyType: "Private room",
    city: "Sintra",
    region: "Lisbon",
    country: "Portugal",
    lat: 38.7973,
    lng: -9.3906,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Breakfast included", "Garden", "Private bathroom", "Free parking on premises", "Heating"],
    price: 85,
    cleaning: 20,
    taxBps: 200,
    minNights: 1,
    photoAlts: ["Quinta garden with fountain", "Guest room with garden view", "Breakfast table"],
  },
  {
    slug: "lagos-cliff",
    host: "rafael",
    title: "Whitewashed Villa on the Algarve Cliffs",
    description:
      "A whitewashed villa with a saltwater pool, perched above the golden sea stacks of Ponta da Piedade. Four bedrooms open onto terraces, and there's a long outdoor table for dinners that run late. Kayak tours into the grottoes leave from the beach below.",
    propertyType: "Villa",
    city: "Lagos",
    region: "Faro",
    country: "Portugal",
    lat: 37.0816,
    lng: -8.6696,
    maxGuests: 8,
    bedrooms: 4,
    beds: 5,
    bathrooms: 3,
    amenities: ["Wifi", "Kitchen", "Pool", "Ocean view", "Air conditioning", "BBQ grill", "Washer", "Free parking on premises", "Outdoor dining area"],
    price: 420,
    cleaning: 160,
    taxBps: 200,
    minNights: 4,
    photoAlts: ["Villa above the sea stacks", "Saltwater pool", "Terrace dining table", "Bedroom with sea view", "Living room"],
  },
  {
    slug: "brooklyn-brownstone",
    host: "rafael",
    title: "Garden-Level Brownstone Flat in Fort Greene",
    description:
      "The garden floor of an 1880s brownstone, with exposed brick, a working (decorative) marble fireplace and French doors to a private backyard with a fig tree. Two subway lines are a four-minute walk, and the park and farmers market are around the corner. I live upstairs and will happily point you toward the best bagels.",
    propertyType: "Apartment",
    city: "Brooklyn",
    region: "New York",
    country: "United States",
    lat: 40.6895,
    lng: -73.9746,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Private backyard", "Washer", "Dryer", "Air conditioning", "Dedicated workspace", "Heating"],
    price: 235,
    cleaning: 85,
    taxBps: 1475,
    minNights: 3,
    photoAlts: ["Brownstone stoop", "Living room with marble fireplace", "Backyard with fig tree", "Second bedroom"],
  },
  // ---- Yuki (Japan + Hawaii) --------------------------------------------
  {
    slug: "kyoto-machiya",
    host: "yuki",
    title: "Restored Machiya Townhouse in Higashiyama",
    description:
      "A century-old wooden townhouse with tatami rooms, sliding paper screens and a tiny moss garden you can watch from a cedar soaking tub. It's a quiet lane five minutes from Yasaka Shrine, which is magical before the crowds arrive. Futons are rolled out each evening; slippers and yukata are provided.",
    propertyType: "Townhouse",
    city: "Kyoto",
    region: "Kyoto",
    country: "Japan",
    lat: 35.0003,
    lng: 135.7788,
    maxGuests: 4,
    bedrooms: 2,
    beds: 4,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Cedar soaking tub", "Garden", "Air conditioning", "Heating", "Washer", "Yukata provided"],
    price: 240,
    cleaning: 60,
    taxBps: 300,
    minNights: 2,
    photoAlts: ["Machiya facade with lattice", "Tatami room with screens", "Moss garden", "Cedar soaking tub"],
  },
  {
    slug: "tokyo-shimokita",
    host: "yuki",
    title: "Compact Studio in Shimokitazawa",
    description:
      "A smart, efficient studio above a record shop in Tokyo's most laid-back neighborhood of vintage stores and tiny bars. Shibuya and Shinjuku are each under ten minutes by train. Everything folds away cleverly — the bed becomes a sofa, the desk tucks into the wall — and the shower is surprisingly powerful.",
    propertyType: "Apartment",
    city: "Tokyo",
    region: "Tokyo",
    country: "Japan",
    lat: 35.6614,
    lng: 139.6681,
    maxGuests: 2,
    bedrooms: 0,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchenette", "Washer", "Air conditioning", "Pocket wifi", "Dedicated workspace"],
    price: 95,
    cleaning: 30,
    taxBps: 200,
    minNights: 1,
    photoAlts: ["Studio with fold-down bed", "Street with vintage shops", "Kitchenette"],
  },
  {
    slug: "hakone-ryokan",
    host: "yuki",
    title: "Private Onsen Suite with Mount Fuji Glimpses",
    description:
      "A suite in our family's small inn, with your own open-air hot spring bath on a cedar deck. On clear winter mornings Fuji peeks over the ridge. A traditional multi-course dinner is available on request; breakfast is included. The Hakone ropeway and open-air museum are a short bus ride away.",
    propertyType: "Ryokan",
    city: "Hakone",
    region: "Kanagawa",
    country: "Japan",
    lat: 35.2324,
    lng: 139.1069,
    maxGuests: 2,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Private onsen", "Breakfast included", "Mountain view", "Air conditioning", "Yukata provided", "Free parking on premises"],
    price: 380,
    cleaning: 50,
    taxBps: 1000,
    minNights: 1,
    photoAlts: ["Open-air onsen on the cedar deck", "Tatami suite", "Kaiseki breakfast", "Misty mountains"],
  },
  {
    slug: "sapporo-snow",
    host: "yuki",
    title: "Warm Family Apartment for Powder Season",
    description:
      "A roomy three-bedroom apartment near Odori Park with heated floors, a genkan big enough for everybody's boots and a ski locker in the basement. The ski resorts are an hour by bus; the snow festival is a walk away in February. Ramen alley is closer than the convenience store.",
    propertyType: "Apartment",
    city: "Sapporo",
    region: "Hokkaido",
    country: "Japan",
    lat: 43.0618,
    lng: 141.3545,
    maxGuests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 1.5,
    amenities: ["Wifi", "Kitchen", "Heated floors", "Ski storage", "Washer", "Dryer", "Elevator", "Crib"],
    price: 175,
    cleaning: 70,
    taxBps: 200,
    minNights: 3,
    photoAlts: ["Living room with snowy view", "Kitchen and dining", "Bunk room", "Odori Park in winter"],
  },
  {
    slug: "maui-upcountry",
    host: "yuki",
    title: "Upcountry Cottage on a Protea Farm",
    description:
      "A plantation-style cottage on a working protea farm on the slopes of Haleakalā, 3,000 feet up where the air is cool and the views stretch to two coasts. Sunrise at the summit is an hour's drive. Fresh avocados and lilikoi from the trees, depending on the season, and a lanai made for slow mornings.",
    propertyType: "Cottage",
    city: "Kula",
    region: "Hawaii",
    country: "United States",
    lat: 20.7909,
    lng: -156.3269,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Lanai", "Ocean view", "Mountain view", "Washer", "Free parking on premises", "BBQ grill"],
    price: 265,
    cleaning: 100,
    taxBps: 1450,
    minNights: 3,
    photoAlts: ["Cottage among protea flowers", "Lanai at sunrise", "Bedroom with louvered windows", "View to the coast"],
  },
  // ---- Chiara (Italy + US) ----------------------------------------------
  {
    slug: "bologna-portico",
    host: "chiara",
    title: "Frescoed Apartment Under the Porticoes",
    description:
      "A second-floor flat in a 17th-century palazzo with a painted ceiling, terracotta floors and a kitchen built for cooking — I'm a food writer, so there's a pasta board, a rolling pin and a well-stocked pantry. The market streets of the Quadrilatero are around the corner, and you can walk to the station under the porticoes without getting rained on.",
    propertyType: "Apartment",
    city: "Bologna",
    region: "Emilia-Romagna",
    country: "Italy",
    lat: 44.4938,
    lng: 11.3426,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Washer", "Air conditioning", "Heating", "Coffee maker", "Cookbooks"],
    price: 130,
    cleaning: 45,
    taxBps: 500,
    minNights: 2,
    photoAlts: ["Frescoed ceiling", "Kitchen with pasta board", "Bedroom with shutters", "Porticoes outside"],
  },
  {
    slug: "tuscany-farmhouse",
    host: "chiara",
    title: "Stone Farmhouse Among the Vines near Montepulciano",
    description:
      "A restored stone farmhouse on a small organic vineyard, with a pool looking out over the Val d'Orcia's cypress-lined roads. Wine tastings with our neighbor are a walk across the field. The kitchen has a wood-fired oven, and in autumn you're welcome to join the harvest.",
    propertyType: "Farm stay",
    city: "Montepulciano",
    region: "Tuscany",
    country: "Italy",
    lat: 43.0924,
    lng: 11.7808,
    maxGuests: 8,
    bedrooms: 4,
    beds: 5,
    bathrooms: 3,
    amenities: ["Wifi", "Kitchen", "Pool", "Wood-fired oven", "Vineyard", "Free parking on premises", "Washer", "Air conditioning", "Outdoor dining area"],
    price: 360,
    cleaning: 140,
    taxBps: 300,
    minNights: 4,
    photoAlts: ["Stone farmhouse with cypresses", "Pool over the valley", "Wood-fired oven", "Rustic bedroom", "Vineyard rows"],
  },
  {
    slug: "amalfi-terrace",
    host: "chiara",
    title: "Lemon-Grove Terrace Room in Positano",
    description:
      "A private room with a terrace looking straight down the cliffs to the sea, in a family house surrounded by lemon terraces. Yes, there are stairs — about 200 of them down to the beach, which is how everyone in Positano stays so fit. Breakfast on the terrace with homemade lemon cake.",
    propertyType: "Private room",
    city: "Positano",
    region: "Campania",
    country: "Italy",
    lat: 40.6281,
    lng: 14.4849,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Breakfast included", "Terrace", "Ocean view", "Air conditioning", "Private bathroom"],
    price: 210,
    cleaning: 40,
    taxBps: 400,
    minNights: 2,
    photoAlts: ["Terrace over the sea", "Lemon grove", "Room with majolica tiles"],
  },
  {
    slug: "chicago-greystone",
    host: "chiara",
    title: "Greystone Two-Flat in Logan Square",
    description:
      "The top floor of a classic Chicago greystone, with bay windows, a clawfoot tub and a back porch overlooking a tree-lined alley. The Blue Line gets you to the Loop in 20 minutes, and the boulevard is lined with great restaurants. I've left a list of my Chicago food essentials — trust me on the Italian beef.",
    propertyType: "Apartment",
    city: "Chicago",
    region: "Illinois",
    country: "United States",
    lat: 41.9231,
    lng: -87.7093,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchen", "Washer", "Dryer", "Air conditioning", "Heating", "Back porch", "Dedicated workspace"],
    price: 145,
    cleaning: 65,
    taxBps: 1500,
    minNights: 2,
    photoAlts: ["Greystone facade", "Bay window living room", "Clawfoot tub", "Back porch"],
  },
  {
    slug: "savannah-carriage",
    host: "chiara",
    title: "Carriage House on a Moss-Draped Square",
    description:
      "A brick carriage house behind an 1850s home in the historic district, with a private courtyard, a gas lantern and live oaks dripping with Spanish moss overhead. Walk everywhere — squares, river, cafés. The heart-pine floors creak in the most charming way.",
    propertyType: "Guesthouse",
    city: "Savannah",
    region: "Georgia",
    country: "United States",
    lat: 32.0749,
    lng: -81.0932,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Kitchenette", "Private courtyard", "Air conditioning", "Bicycles", "Coffee maker"],
    price: 175,
    cleaning: 60,
    taxBps: 1300,
    minNights: 2,
    photoAlts: ["Brick carriage house", "Courtyard with gas lantern", "Bedroom with heart-pine floors", "Live oaks on the square"],
  },
  {
    slug: "austin-airstream",
    host: "demoHost",
    title: "Vintage Airstream Under the Live Oaks",
    description:
      "A polished 1968 Airstream parked in a shady backyard in East Austin, with a cedar deck, string lights and a stock-tank pool for the hot months. Inside it's all birch plywood and clever storage. Food trucks and live music are a short bike ride away — two cruisers are included.",
    propertyType: "Camper/RV",
    city: "Austin",
    region: "Texas",
    country: "United States",
    lat: 30.2625,
    lng: -97.7178,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["Wifi", "Air conditioning", "Stock-tank pool", "Bicycles", "Outdoor shower", "Coffee maker", "Mini fridge"],
    price: 115,
    cleaning: 45,
    taxBps: 1500,
    minNights: 1,
    photoAlts: ["Airstream under live oaks", "Birch-paneled interior", "Stock-tank pool and deck", "String lights at night"],
  },
];

// ---------------------------------------------------------------------------
// Review copy
// ---------------------------------------------------------------------------
const REVIEWS: Record<number, string[]> = {
  5: [
    "Everything was exactly as described, and somehow better. {host} left a handwritten list of nearby spots that made our trip.",
    "We've stayed in a lot of rentals and this is the first one where the kitchen actually had sharp knives. Spotless, cozy, and the location in {city} was perfect.",
    "Honestly one of the most memorable places we've ever stayed. We're already planning to come back next year.",
    "Check-in was effortless, the bed was incredibly comfortable and {host} was quick to answer every question. Ten out of ten.",
    "Photos don't do it justice. We spent most evenings just sitting outside soaking it in. Thank you, {host}!",
    "Perfect base for exploring {city}. Quiet at night, walkable during the day, and thoughtfully stocked.",
    "My partner and I came for a long weekend and extended it by two nights. That says everything.",
    "The little details — good coffee, extra blankets, a stack of local guidebooks — made this feel like a home rather than a rental.",
  ],
  4: [
    "Lovely place in a great spot. The water pressure was a bit weak, but that's our only complaint.",
    "Really enjoyed our stay. A little more noise from the street than we expected, but {host} had earplugs ready, which we appreciated.",
    "Beautiful and comfortable. Parking was tricky to find the first night — follow {host}'s directions exactly and you'll be fine.",
    "Great value for {city}. The bed was on the firm side for us, but everything else was wonderful.",
    "Charming, clean and well located. Wi-Fi dropped a couple of times on a work call, otherwise excellent.",
    "We had a great time. The photos are accurate, and {host} was friendly and responsive. Would stay again.",
  ],
  3: [
    "The setting is gorgeous, but the place needs some upkeep — a sticky door, a dripping tap, and the oven didn't heat evenly. {host} was apologetic and responsive.",
    "Fine for a night or two. It's smaller than the photos suggest and the heating took a long time to warm things up.",
    "Good location, but cleaning wasn't quite up to standard when we arrived. {host} sent someone over the same day, which helped.",
  ],
};

function reviewBody(rating: number, hostName: string, city: string): string {
  const first = hostName.split(" ")[0];
  return pick(REVIEWS[rating]).replaceAll("{host}", first).replaceAll("{city}", city);
}

function pickRating(): number {
  const r = rand();
  if (r < 0.62) return 5;
  if (r < 0.95) return 4;
  return 3;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function wipe() {
  // Children before parents. Donation/Review reference User & Booking.
  await prisma.review.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Wiping existing data…");
  await wipe();

  // --- Users -------------------------------------------------------------
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: Record<string, { id: string; name: string }> = {};
  const accountAgeDays = (i: number) => 400 + i * 23;

  for (const [i, u] of [...HOSTS, ...GUESTS].entries()) {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
        bio: u.bio ?? null,
        avatarUrl: avatarUrl(u.key),
        createdAt: addDays(TODAY, -accountAgeDays(i)),
      },
    });
    users[u.key] = { id: created.id, name: created.name };
  }
  console.log(`Created ${HOSTS.length} hosts and ${GUESTS.length} guests.`);

  // --- Listings + photos -------------------------------------------------
  const listings: { id: string; data: SeedListing }[] = [];
  for (const [i, l] of L.entries()) {
    const created = await prisma.listing.create({
      data: {
        hostId: users[l.host].id,
        title: l.title,
        description: l.description,
        propertyType: l.propertyType,
        city: l.city,
        region: l.region,
        country: l.country,
        latitude: l.lat,
        longitude: l.lng,
        maxGuests: l.maxGuests,
        bedrooms: l.bedrooms,
        beds: l.beds,
        bathrooms: l.bathrooms,
        amenities: l.amenities,
        nightlyPriceCents: l.price * 100,
        cleaningFeeCents: l.cleaning * 100,
        taxRateBps: Math.min(1500, Math.max(0, l.taxBps)),
        minNights: l.minNights,
        currency: "usd",
        published: true,
        createdAt: addDays(TODAY, -(380 - i * 3)),
        photos: {
          create: l.photoAlts.slice(0, 5).map((alt, position) => ({
            url: photoUrl(`fairbnb-${l.slug}-${position + 1}`),
            alt,
            position,
          })),
        },
      },
    });
    listings.push({ id: created.id, data: l });
  }
  console.log(`Created ${listings.length} listings.`);

  // --- Bookings ----------------------------------------------------------
  // The demo guest is excluded from random picks so their trip history never overlaps itself.
  const guestKeys = GUESTS.map((g) => g.key).filter((k) => k !== "demoGuest");
  let bookingCount = 0;
  let reviewCount = 0;
  const donationBookings: { bookingId: string; guestKey: string; cents: number; at: Date }[] = [];

  async function createBooking(opts: {
    listing: { id: string; data: SeedListing };
    guestKey: string;
    checkIn: Date;
    nights: number;
    status: BookingStatus;
    donationCents?: number;
    review?: boolean;
  }) {
    const { listing, guestKey, checkIn, nights, status } = opts;
    const l = listing.data;
    const price = calculatePrice({
      nightlyPriceCents: l.price * 100,
      cleaningFeeCents: l.cleaning * 100,
      taxRateBps: Math.min(1500, Math.max(0, l.taxBps)),
      nights,
      donationCents: opts.donationCents ?? 0,
    });
    const checkOut = addDays(checkIn, nights);
    const booking = await prisma.booking.create({
      data: {
        listingId: listing.id,
        guestId: users[guestKey].id,
        checkIn,
        checkOut,
        guests: randInt(1, Math.min(l.maxGuests, 4)),
        status,
        nights: price.nights,
        subtotalCents: price.subtotalCents,
        cleaningFeeCents: price.cleaningFeeCents,
        taxCents: price.taxCents,
        processingCents: price.processingCents,
        platformFeeCents: price.platformFeeCents,
        donationCents: price.donationCents,
        totalCents: price.totalCents,
        hostPayoutCents: price.hostPayoutCents,
        currency: "usd",
        paymentMode: "mock",
        createdAt: addDays(checkIn, -randInt(10, 60)),
      },
    });
    bookingCount++;

    if (price.donationCents > 0) {
      donationBookings.push({
        bookingId: booking.id,
        guestKey,
        cents: price.donationCents,
        at: booking.createdAt,
      });
    }

    if (opts.review) {
      const rating = pickRating();
      const host = HOSTS.find((h) => h.key === l.host)!;
      await prisma.review.create({
        data: {
          listingId: listing.id,
          authorId: users[guestKey].id,
          bookingId: booking.id,
          rating,
          body: reviewBody(rating, host.name, l.city),
          createdAt: addDays(checkOut, randInt(1, 4)),
        },
      });
      reviewCount++;
    }
    return booking;
  }

  // Past COMPLETED stays: walk backwards from ~2 weeks ago, non-overlapping per listing.
  for (const [i, listing] of listings.entries()) {
    const stays = 2 + (i % 3); // 2-4 past stays per listing
    // Demo-guest listings (every 6th) get staggered first stays ~5 weeks apart.
    let cursor = addDays(TODAY, i % 6 === 0 ? -(12 + (i / 6) * 35) : -randInt(12, 40));
    for (let s = 0; s < stays; s++) {
      const nights = Math.max(listing.data.minNights, randInt(2, 6));
      const checkOut = cursor;
      const checkIn = addDays(checkOut, -nights);
      // The demo guest gets the first stay on every 6th listing.
      const guestKey = s === 0 && i % 6 === 0 ? "demoGuest" : pick(guestKeys);
      const donation = rand() < 0.07 ? pick([500, 1000, 1500, 2500]) : 0;
      await createBooking({
        listing,
        guestKey,
        checkIn,
        nights,
        status: BookingStatus.COMPLETED,
        donationCents: donation,
        review: rand() < 0.88, // most guests leave a review
      });
      cursor = addDays(checkIn, -randInt(5, 45));
    }
  }

  // Future CONFIRMED stays — fixed offsets so availability conflicts are easy to demo.
  const bySlug = (slug: string) => listings.find((l) => l.data.slug === slug)!;
  const upcoming: { slug: string; guestKey: string; inDays: number; nights: number; donation?: number }[] = [
    { slug: "portland-craftsman", guestKey: "demoGuest", inDays: 14, nights: 4, donation: 1000 },
    { slug: "portland-craftsman", guestKey: "priya", inDays: 30, nights: 3 },
    { slug: "bend-aframe", guestKey: "marcus", inDays: 21, nights: 5 },
    { slug: "sedona-casita", guestKey: "elena", inDays: 9, nights: 3 },
    { slug: "kyoto-machiya", guestKey: "kenji", inDays: 40, nights: 6 },
    { slug: "lisbon-alfama", guestKey: "olivia", inDays: 18, nights: 5 },
    { slug: "mont-tremblant-chalet", guestKey: "hannah", inDays: 35, nights: 4, donation: 2000 },
    { slug: "oaxaca-courtyard", guestKey: "demoGuest", inDays: 60, nights: 7 },
  ];
  for (const u of upcoming) {
    const listing = bySlug(u.slug);
    await createBooking({
      listing,
      guestKey: u.guestKey,
      checkIn: addDays(TODAY, u.inDays),
      nights: Math.max(u.nights, listing.data.minNights),
      status: BookingStatus.CONFIRMED,
      donationCents: u.donation,
    });
  }
  console.log(`Created ${bookingCount} bookings and ${reviewCount} reviews.`);

  // --- Donations ---------------------------------------------------------
  // Every booking-time donation gets a matching ledger row, plus some direct gifts.
  const direct: { guestKey: string | null; cents: number; daysAgo: number }[] = [
    { guestKey: "demoGuest", cents: 2500, daysAgo: 200 },
    { guestKey: "priya", cents: 5000, daysAgo: 150 },
    { guestKey: null, cents: 10000, daysAgo: 120 }, // anonymous
    { guestKey: "demoHost", cents: 2000, daysAgo: 90 },
    { guestKey: "tom", cents: 1000, daysAgo: 45 },
    { guestKey: null, cents: 25000, daysAgo: 20 }, // anonymous
  ];
  await prisma.donation.createMany({
    data: [
      ...donationBookings.map((d) => ({
        userId: users[d.guestKey].id,
        bookingId: d.bookingId,
        amountCents: d.cents,
        currency: "usd",
        source: "booking",
        createdAt: d.at,
      })),
      ...direct.map((d) => ({
        userId: d.guestKey ? users[d.guestKey].id : null,
        amountCents: d.cents,
        currency: "usd",
        source: "direct",
        createdAt: addDays(TODAY, -d.daysAgo),
      })),
    ],
  });
  console.log(`Created ${donationBookings.length + direct.length} donations.`);

  // --- Expenses ----------------------------------------------------------
  const monthStart = (monthsAgo: number) =>
    new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - monthsAgo, 1));
  const expenses = [
    { category: "domain", description: "Domain registration renewal (1 year)", amountCents: 1599, incurredOn: monthStart(9) },
    { category: "legal", description: "Terms of service & privacy policy review", amountCents: 120000, incurredOn: monthStart(8) },
    { category: "legal", description: "Nonprofit incorporation filing fees", amountCents: 32500, incurredOn: monthStart(8) },
    ...[5, 4, 3, 2, 1, 0].map((m) => ({
      category: "hosting",
      description: "Managed Postgres + app hosting",
      amountCents: 4800 + (5 - m) * 600,
      incurredOn: monthStart(m),
    })),
    { category: "hosting", description: "Image CDN bandwidth", amountCents: 1900, incurredOn: monthStart(1) },
    { category: "payments", description: "Card processing on donations (passed through at cost)", amountCents: 1137, incurredOn: monthStart(1) },
    { category: "payments", description: "Card processing on donations (passed through at cost)", amountCents: 1462, incurredOn: monthStart(0) },
    { category: "email", description: "Transactional email service", amountCents: 2000, incurredOn: monthStart(0) },
  ];
  await prisma.expense.createMany({ data: expenses.map((e) => ({ ...e, currency: "usd" })) });
  console.log(`Created ${expenses.length} expenses.`);

  console.log("\nDemo accounts (password: password123):");
  console.log("  host@fairbnb.test   (host with listings)");
  console.log("  guest@fairbnb.test  (guest with past + upcoming trips)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
