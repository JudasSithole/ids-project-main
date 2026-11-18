import FlowReplay from "@/components/FlowReplay";
import { replayData } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function Home() { return <FlowReplay data={await replayData()}/>; }
