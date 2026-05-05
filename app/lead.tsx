import { Redirect } from 'expo-router';

/** Legacy leaderboard route — app no longer uses weekly lead. */
export default function LeadRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
