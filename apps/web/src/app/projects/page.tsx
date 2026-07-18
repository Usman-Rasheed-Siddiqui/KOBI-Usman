import { PageHero } from "@/components/page-hero";
import { SearchExperience } from "@/components/search-experience";
export const metadata={title:"Projects"};
export default function Page(){return <main><PageHero badge="Open ecosystem" title="Projects worth showing up for." description="Discover active open-source projects without ranking everything by stars. KOBI weighs freshness, health, contribution clarity and fit."/><SearchExperience mode="projects"/></main>}
