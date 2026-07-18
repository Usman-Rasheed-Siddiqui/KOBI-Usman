import { PageHero } from "@/components/page-hero";
import { SearchExperience } from "@/components/search-experience";
export const metadata={title:"Hardware"};
export default function Page(){return <main><PageHero badge="Beyond code" title="Build in the physical world." description="Discover firmware, PCB, CAD, robotics, FPGA, ESP32, Arduino and open scientific hardware projects that welcome collaborators."/><SearchExperience initialQuery="open source robotics ESP32 hardware" mode="hardware"/></main>}
