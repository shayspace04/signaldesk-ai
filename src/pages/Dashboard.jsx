import { motion } from "framer-motion";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatCard from "@/components/dashboard/StatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import RecommendationCard from "@/components/dashboard/RecommendationCard";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import OverviewChart from "@/components/dashboard/OverviewChart";
import RecentTickets from "@/components/dashboard/RecentTickets";
import SystemHealth from "@/components/dashboard/SystemHealth";
import QuickActions from "@/components/dashboard/QuickActions";
import AgentStatusBar from "@/components/dashboard/AgentStatusBar";

import { stats } from "@/data/mockDashboard";

export default function Dashboard() {
  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.35,
        ease: "easeOut",
      }}
    >
      <DashboardHeader />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6">
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <AgentStatusBar />

      {/* Workflow */}
      <WorkflowCanvas />

      {/* Chart + Activity */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <OverviewChart />
        </div>

        <ActivityFeed />
      </div>

      {/* Tickets + Health */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <RecentTickets />
        </div>

        <SystemHealth />
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <RecommendationCard />
        </div>

        <QuickActions />
      </div>
    </motion.div>
  );
}