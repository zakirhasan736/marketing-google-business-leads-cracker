export interface RankStyle {
  backgroundColor: string;
  label: string;
  legendLabel: string;
}

export function getRankStyle(rank: number): RankStyle {
  if (rank === 1) {
    return {
      backgroundColor: "#166534",
      label: "1",
      legendLabel: "Rank 1",
    };
  }
  if (rank <= 3) {
    return {
      backgroundColor: "#4ade80",
      label: String(rank),
      legendLabel: "Rank 2-3",
    };
  }
  if (rank <= 10) {
    return {
      backgroundColor: "#facc15",
      label: String(rank),
      legendLabel: "Rank 4-10",
    };
  }
  if (rank <= 19) {
    return {
      backgroundColor: "#fb923c",
      label: String(rank),
      legendLabel: "Rank 11-19",
    };
  }
  return {
    backgroundColor: "#dc2626",
    label: "20+",
    legendLabel: "Rank 20+",
  };
}

export const HEATMAP_LEGEND: RankStyle[] = [
  { backgroundColor: "#166534", label: "1", legendLabel: "Rank 1" },
  { backgroundColor: "#4ade80", label: "3", legendLabel: "Rank 2-3" },
  { backgroundColor: "#facc15", label: "8", legendLabel: "Rank 4-10" },
  { backgroundColor: "#fb923c", label: "15", legendLabel: "Rank 11-19" },
  { backgroundColor: "#dc2626", label: "20+", legendLabel: "Rank 20+" },
];
