import { Redirect } from 'expo-router';

/** Legacy per-user weekly board — removed. */
export default function LeaderWeekRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
