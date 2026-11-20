import { useSignedInAuthSession } from '../auth/AuthSessionProvider';
import { HomeScreen } from '../home/HomeScreen';

export default function TodayRoute() {
  const authSession = useSignedInAuthSession();
  return <HomeScreen key={authSession.user.id} authSession={authSession} />;
}
