import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { EventStatus, UserRole } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const demoUsers = [
  {
    name: "Avery Customer",
    email: "customer@eventbooking.local",
    role: UserRole.customer,
  },
  {
    name: "Morgan Admin",
    email: "admin@eventbooking.local",
    role: UserRole.admin,
  },
  {
    name: "Riley Staff",
    email: "staff@eventbooking.local",
    role: UserRole.staff,
  },
];

const demoVenues = [
  {
    name: "Riverfront Arena",
    address: "100 Festival Drive",
    city: "Austin",
    state: "TX",
    country: "USA",
  },
  {
    name: "Skyline Hall",
    address: "42 Market Street",
    city: "San Francisco",
    state: "CA",
    country: "USA",
  },
];

function futureDate(daysFromNow: number, hourUtc: number, minuteUtc = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return date;
}

async function seedUsers() {
  await Promise.all(
    demoUsers.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: user,
        create: user,
      }),
    ),
  );
}

async function seedVenue(venue: (typeof demoVenues)[number]) {
  const existingVenue = await prisma.venue.findFirst({
    where: {
      name: venue.name,
      city: venue.city,
    },
  });

  if (existingVenue) {
    return prisma.venue.update({
      where: { id: existingVenue.id },
      data: venue,
    });
  }

  return prisma.venue.create({ data: venue });
}

async function seedEvents() {
  const [riverfrontArena, skylineHall] = await Promise.all(
    demoVenues.map(seedVenue),
  );

  if (!riverfrontArena || !skylineHall) {
    throw new Error("Expected demo venues were not created.");
  }

  await upsertEventWithTicketTypes({
    title: "Indie Nights Live",
    description:
      "A high-energy evening featuring three independent bands, food vendors, and late-night sets.",
    category: "Music",
    startsAt: futureDate(45, 19),
    endsAt: futureDate(45, 23),
    status: EventStatus.published,
    heroImageUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
    venueId: riverfrontArena.id,
    ticketTypes: [
      {
        name: "General Admission",
        description: "Standing access to the main floor.",
        priceCents: 4500,
        currency: "USD",
        capacity: 250,
      },
      {
        name: "Balcony",
        description: "Reserved balcony access with elevated stage views.",
        priceCents: 7000,
        currency: "USD",
        capacity: 80,
      },
    ],
  });

  await upsertEventWithTicketTypes({
    title: "Startup Product Summit",
    description:
      "A practical conference for builders covering product strategy, engineering execution, and launch operations.",
    category: "Conference",
    startsAt: futureDate(72, 16),
    endsAt: futureDate(72, 23),
    status: EventStatus.published,
    heroImageUrl:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
    venueId: skylineHall.id,
    ticketTypes: [
      {
        name: "Standard Pass",
        description: "Full-day conference access.",
        priceCents: 12900,
        currency: "USD",
        capacity: 180,
      },
      {
        name: "Founder Pass",
        description: "Conference access plus founder roundtable session.",
        priceCents: 19900,
        currency: "USD",
        capacity: 40,
      },
    ],
  });

  await upsertEventWithTicketTypes({
    title: "Chef's Table Weekend",
    description:
      "A curated tasting event with local chefs, seasonal menus, and paired drinks.",
    category: "Food",
    startsAt: futureDate(96, 0, 30),
    endsAt: futureDate(96, 4),
    status: EventStatus.draft,
    heroImageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0",
    venueId: riverfrontArena.id,
    ticketTypes: [
      {
        name: "Tasting Seat",
        description: "Dinner tasting menu with paired drinks.",
        priceCents: 9500,
        currency: "USD",
        capacity: 60,
      },
    ],
  });
}

async function upsertEventWithTicketTypes({
  ticketTypes,
  ...event
}: {
  title: string;
  description: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  heroImageUrl: string;
  venueId: string;
  ticketTypes: Array<{
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    capacity: number;
  }>;
}) {
  const existingEvent = await prisma.event.findFirst({
    where: {
      title: event.title,
    },
  });

  const savedEvent = existingEvent
    ? await prisma.event.update({
        where: { id: existingEvent.id },
        data: event,
      })
    : await prisma.event.create({
        data: event,
      });

  await prisma.ticketType.deleteMany({
    where: { eventId: savedEvent.id },
  });

  await prisma.ticketType.createMany({
    data: ticketTypes.map((ticketType) => ({
      ...ticketType,
      eventId: savedEvent.id,
    })),
  });
}

async function main() {
  await seedUsers();
  await seedEvents();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
