import { getStudioUserAssetApi } from "./api.ts";

export const listPendingEvolutionRecords = () =>
  getStudioUserAssetApi()
    .listEvolutionRecords()
    .filter((item) => item.approvalStatus === "pending_review");

export const listApprovedEvolutionRecords = () =>
  getStudioUserAssetApi()
    .listEvolutionRecords()
    .filter((item) => item.approvalStatus === "approved");

export const listRejectedEvolutionRecords = () =>
  getStudioUserAssetApi()
    .listEvolutionRecords()
    .filter((item) => item.approvalStatus === "rejected");
