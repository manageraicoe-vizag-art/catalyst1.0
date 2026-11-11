import { DEFAULT_SETTINGS } from '../constants'
import type {
  ActionType,
  InterestRequest,
  Investor,
  Notice,
  RequestHandling,
  Startup,
  StartupPrivate,
} from '../types'

/**
 * SAMPLE data for demo mode only. These startups and funds are fictional placeholders.
 * Replace them with the real shared startup list (Organiser → Startups → Import CSV).
 */
type Row = [
  name: string,
  sector: string,
  stage: string,
  description: string,
  problem: string,
  solution: string,
  traction: string,
  ask: string,
]

const ROWS: Row[] = [
  ['TideSense', 'AquaTech', 'Seed', 'IoT water-quality monitoring for shrimp farms.', 'Shrimp farmers lose up to 30% of a crop to sudden oxygen and pH swings they cannot see in time.', 'Solar-powered pond sensors with SMS and WhatsApp alerts in Telugu, plus an aerator auto-switch.', '140 ponds live across Bhimavaram and Nellore; ₹38L ARR.', '₹3 Cr seed for 2,000 pond deployments.'],
  ['PortPilot', 'Logistics', 'Pre-Series A', 'AI berth and container scheduling for mid-size ports.', 'Vessel waiting times at Indian ports add ₹20,000+ per ship per hour in demurrage.', 'A scheduling engine that plans berths, cranes and trucks together and replans every 15 minutes.', '2 port pilots, 11% reduction in average turnaround.', '₹8 Cr to scale to 6 ports.'],
  ['VanaHealth', 'HealthTech', 'Seed', 'Telehealth kiosks for tribal and remote villages.', 'Tribal hamlets in the Eastern Ghats are often 40 km from the nearest doctor.', 'Village kiosks run by trained health workers with diagnostics and video consults.', '22 kiosks, 9,400 consultations.', '₹2.5 Cr for 100 kiosks.'],
  ['KhetScore', 'FinTech', 'Pre-seed', 'Alternative credit scores for smallholder farmers.', 'Most small farmers have no bureau score and pay 24–36% to informal lenders.', 'Scores from satellite crop data, mandi sales and repayment history, sold to NBFCs.', '3 lender partners, 6,000 farmers scored.', '₹1.5 Cr pre-seed.'],
  ['HullBot Robotics', 'DeepTech', 'Seed', 'Underwater drones that clean and inspect ship hulls.', 'Hull fouling raises fuel use by up to 15%; manual diving is slow and risky.', 'Tethered robots that clean hulls in port and produce an inspection report.', '4 paid pilots with ship operators.', '₹5 Cr seed.'],
  ['PaathShala', 'EdTech', 'Pre-Series A', 'Telugu-first exam preparation app.', 'Rural students preparing for state exams lack quality content in their language.', 'Video lessons, mock tests and doubt-solving in Telugu at ₹99 a month.', '1.2 lakh monthly active learners, 6,800 paid.', '₹6 Cr Pre-Series A.'],
  ['Rooftop Exchange', 'CleanTech', 'Seed', 'Peer-to-peer trading for rooftop solar power.', 'Rooftop owners earn little for surplus power while neighbours pay peak tariffs.', 'A metering and settlement platform that lets apartments trade surplus solar.', 'Pilot in 3 gated communities, 410 households.', '₹4 Cr seed.'],
  ['Lacquerline', 'D2C', 'Pre-seed', 'Marketplace for Etikoppaka lacquer toys and crafts.', 'Artisans earn a fraction of the retail price through middlemen.', 'Direct-to-consumer brand with artisan profit-sharing and export logistics.', '₹62L GMV in 12 months, 70 artisans.', '₹1 Cr pre-seed.'],
  ['ColdLoop', 'AgriTech', 'Seed', 'Solar cold rooms for fishing harbours.', 'Small fishers sell at distress prices because they cannot store their catch.', 'Pay-per-crate solar cold storage at harbours with a booking app.', '5 units running at 81% utilisation.', '₹3.5 Cr seed.'],
  ['SteelSight', 'Industry 4.0', 'Seed', 'Computer-vision quality inspection for steel plants.', 'Surface defects are caught late, causing rework and rejected coils.', 'Line cameras and models that flag defects in real time.', '1 integrated plant customer, 2 more in trials.', '₹4 Cr seed.'],
  ['Saathi Care', 'HealthTech', 'Pre-seed', 'Trained home caregivers for elders.', 'Families with children abroad struggle to find reliable elder care at home.', 'Verified caregivers, visit tracking and a family app.', '180 families subscribed in Visakhapatnam.', '₹1.2 Cr pre-seed.'],
  ['ShoreSafe', 'ClimateTech', 'Seed', 'Coastal flood and storm-surge early warning.', 'Cyclone surges give coastal villages little usable warning.', 'Low-cost tide gauges and models that send hyperlocal alerts.', 'MoU with 2 district administrations.', '₹2 Cr seed.'],
  ['FleetFuel', 'Mobility', 'Seed', 'Charging and battery swapping for EV delivery fleets.', 'Last-mile fleets cannot electrify without reliable charging.', 'Depot charging plus swap stations, billed per kilometre.', '600 EVs served daily.', '₹5 Cr seed.'],
  ['GreenFeed', 'AgriTech', 'Pre-seed', 'Insect-protein feed for aquaculture.', 'Fishmeal prices are volatile and the supply is unsustainable.', 'Black soldier fly larvae reared on food waste, processed into feed.', 'Pilot plant producing 2 tonnes a month.', '₹1.8 Cr pre-seed.'],
  ['NeoLedger', 'SaaS', 'Pre-Series A', 'GST reconciliation for MSMEs.', 'MSMEs lose input tax credit to mismatched invoices.', 'Automatic matching of purchase registers with GST returns, plus supplier nudges.', '1,100 paying MSMEs; ₹1.4 Cr ARR.', '₹7 Cr Pre-Series A.'],
  ['SkillDock', 'EdTech', 'Seed', 'VR training for shipyard and port workers.', 'Hazardous-task training is expensive and unsafe on live equipment.', 'VR modules for welding, crane and safety drills with assessments.', '3 enterprise customers, 2,300 trainees.', '₹3 Cr seed.'],
  ['Kelp Wrap', 'Materials', 'Pre-seed', 'Seaweed-based compostable packaging.', 'Single-use plastic bans leave food businesses without affordable alternatives.', 'Films and pouches made from farmed seaweed that compost in 6 weeks.', 'Lab-scale validated; 4 letters of intent.', '₹1.5 Cr pre-seed.'],
  ['MediTrack Rx', 'HealthTech', 'Seed', 'Inventory and expiry management for pharmacies.', 'Independent pharmacies lose 3–5% of stock to expiry.', 'Billing, inventory and expiry-return automation in one app.', '850 pharmacies; ₹55L ARR.', '₹3 Cr seed.'],
  ['TrailVizag', 'Travel', 'Pre-seed', 'Experiential tourism bookings for the Andhra coast and hills.', 'Local experiences are hard to discover and book online.', 'Curated trips with local hosts, from beaches to hill coffee estates.', '3,200 bookings; 4.8 average rating.', '₹1 Cr pre-seed.'],
  ['AquaGenix', 'BioTech', 'Seed', 'Disease-resistant shrimp broodstock.', 'Viral outbreaks wipe out entire shrimp crops.', 'Selectively bred, specific-pathogen-free broodstock with traceability.', 'Hatchery trials with 2 partners.', '₹6 Cr seed.'],
  ['CivicPulse', 'GovTech', 'Seed', 'Analytics for citizen grievance redressal.', 'Municipal bodies cannot see grievance patterns or response delays.', 'A dashboard that classifies complaints and tracks resolution.', '2 municipal corporations live.', '₹2 Cr seed.'],
]

const FUNDS: Array<[name: string, fund: string, designation: string]> = [
  ['Ananya Rao', 'Waltair Ventures', 'Partner'],
  ['Vikram Reddy', 'Kailasa Capital', 'Principal'],
  ['Sneha Iyer', 'Rushikonda Angels', 'Angel investor'],
  ['Rahul Varma', 'Eastern Ghats Fund', 'Managing Partner'],
  ['Priya Nair', 'Lighthouse Seed Partners', 'Associate'],
  ['Karthik Menon', 'Bayfront Capital', 'Vice President'],
  ['Divya Prasad', 'Deccan Tide Ventures', 'Partner'],
  ['Arjun Shetty', 'Coromandel Partners', 'Investment Manager'],
]

export interface SeedData {
  startups: Startup[]
  privates: StartupPrivate[]
  investors: Investor[]
  requests: InterestRequest[]
  handling: RequestHandling[]
  notices: Notice[]
}

export function buildSeed(): SeedData {
  const now = Date.now()
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString()

  const startups: Startup[] = ROWS.map((r, i) => ({
    id: `sample-${i + 1}`,
    position: i + 1,
    name: r[0],
    sector: r[1],
    stage: r[2],
    description: r[3],
    problem: r[4],
    solution: r[5],
    traction: r[6],
    ask: r[7],
    market: 'Sample market sizing goes here. Replace with the startup’s own one-pager content.',
    businessModel: 'Sample business model. Replace with the startup’s own one-pager content.',
    team: 'Sample founding team. Replace with the startup’s own one-pager content.',
    founders: '',
    city: 'Visakhapatnam',
    website: '',
    onePagerUrl: '',
    status: i < 4 ? 'done' : i === 4 ? 'pitching' : 'queued',
    hidden: false,
    updatedAt: iso(120),
  }))

  const privates: StartupPrivate[] = startups.map((s) => ({
    startupId: s.id,
    deckUrl: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  }))

  const investors: Investor[] = FUNDS.map(([name, fund, designation], i) => ({
    id: `sample-inv-${i + 1}`,
    name,
    fund,
    designation,
    email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
    phone: '',
    inviteToken: `sampletoken${i + 1}`,
    createdAt: iso(180 - i * 7),
    createdBy: 'self',
  }))

  // Deterministic spread of sample interest across the first startups.
  const picks: Array<[inv: number, st: number, type: ActionType, minsAgo: number]> = [
    [0, 0, 'deck', 95], [0, 0, 'meet_today', 94], [1, 0, 'deck', 90], [2, 0, 'meet_later', 88],
    [3, 1, 'deck', 70], [3, 1, 'meet_today', 69], [4, 1, 'deck', 66], [5, 1, 'meet_later', 60],
    [6, 2, 'deck', 52], [1, 2, 'meet_today', 50], [7, 2, 'deck', 47],
    [0, 3, 'meet_later', 35], [2, 3, 'deck', 33], [5, 3, 'deck', 30], [6, 3, 'meet_today', 29],
    [4, 4, 'deck', 8], [7, 4, 'meet_today', 4],
  ]
  const requests: InterestRequest[] = picks.map(([inv, st, type, mins], i) => ({
    id: `sample-req-${i + 1}`,
    investorId: investors[inv]!.id,
    startupId: startups[st]!.id,
    type,
    active: true,
    createdAt: iso(mins),
    updatedAt: iso(mins),
    withdrawnAt: null,
  }))

  const handling: RequestHandling[] = []
  const notices: Notice[] = []
  // One approved + notified meeting, one approved-not-yet-notified, to show the flow.
  const approve = (reqIdx: number, room: string, at: string, notify: boolean) => {
    const r = requests[reqIdx]!
    handling.push({
      requestId: r.id,
      status: 'approved',
      room,
      meetingAt: at,
      deckLink: '',
      message: '',
      organiserNote: '',
      approvedAt: iso(20),
      notifiedAt: notify ? iso(18) : null,
    })
    if (notify)
      notices.push({
        id: `sample-notice-${reqIdx}`,
        investorId: r.investorId,
        requestId: r.id,
        startupId: r.startupId,
        type: r.type,
        room,
        meetingAt: at,
        deckLink: '',
        message: 'Please arrive 5 minutes early. The founders will meet you at the room.',
        createdAt: iso(18),
        readAt: null,
      })
  }
  approve(1, 'Meeting Room 1', '15:30', true)
  approve(5, 'Meeting Room 2', '15:45', false)

  return { startups, privates, investors, requests, handling, notices }
}

export const SEED_SETTINGS = DEFAULT_SETTINGS
