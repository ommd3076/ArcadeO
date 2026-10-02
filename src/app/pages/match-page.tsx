import { MatchScreen } from "../../screens/match";
import { useAuth } from "../auth";
export function MatchPage() {
  const { session } = useAuth();
  return session ? <MatchScreen actorAccountId={session.profile.id} /> : null;
}
