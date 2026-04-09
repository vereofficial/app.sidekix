import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Missing' }} />
      <View style={styles.box}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Link href="/today" style={styles.link}>
          <Text style={styles.linkText}>Go to Today</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 18, marginBottom: 16 },
  link: { marginTop: 8 },
  linkText: { fontSize: 16, color: '#D4FF3F' },
});
