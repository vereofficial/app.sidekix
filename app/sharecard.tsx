import { Redirect } from 'expo-router';

/** Legacy weekly rank share card — removed. */
export default function ShareCardRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
