function normalizeTeam(team) {
  return typeof team === "string" ? team.trim().toLowerCase() : "";
}

export function getScoreDelta(match, event) {
  const suppliedDelta = event.scoreDelta;
  if (suppliedDelta) {
    return {
      home: suppliedDelta.home,
      away: suppliedDelta.away,
    };
  }

  const eventType = String(event.eventType ?? "").toLowerCase();
  const sport = String(match.sport ?? "").toLowerCase();
  const team = normalizeTeam(event.team);
  const homeTeam = normalizeTeam(match.homeTeam);
  const awayTeam = normalizeTeam(match.awayTeam);

  let points = 0;
  if (sport === "football" && eventType === "goal") points = 1;
  if (sport === "cricket") {
    if (eventType === "boundary" || eventType === "four") points = 4;
    if (eventType === "six") points = 6;
  }
  if (sport === "basketball") {
    if (eventType === "three_pointer" || eventType === "three") points = 3;
    if (eventType === "basket" || eventType === "two_pointer") points = 2;
    if (eventType === "free_throw") points = 1;
  }

  if (!points || !team) return null;
  if (team === homeTeam) return { home: points, away: 0 };
  if (team === awayTeam) return { home: 0, away: points };
  return null;
}
