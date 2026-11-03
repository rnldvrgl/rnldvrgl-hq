import { LoadingScreen } from "@/components/office/LoadingScreen";

/** Shown while the server loads the office state for the first paint. */
export default function Loading() {
  return <LoadingScreen label="Unlocking the office" />;
}
