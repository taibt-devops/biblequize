package com.biblequiz.modules.tournament.service;

import com.biblequiz.modules.tournament.entity.Tournament;
import com.biblequiz.modules.tournament.entity.TournamentMatch;
import com.biblequiz.modules.tournament.entity.TournamentMatchParticipant;
import com.biblequiz.modules.tournament.entity.TournamentParticipant;
import com.biblequiz.modules.tournament.repository.TournamentMatchParticipantRepository;
import com.biblequiz.modules.tournament.repository.TournamentMatchRepository;
import com.biblequiz.modules.tournament.repository.TournamentParticipantRepository;
import com.biblequiz.modules.tournament.repository.TournamentRepository;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TournamentService {

    private static final Logger log = LoggerFactory.getLogger(TournamentService.class);

    @Autowired
    private TournamentRepository tournamentRepository;

    @Autowired
    private TournamentParticipantRepository participantRepository;

    @Autowired
    private TournamentMatchRepository matchRepository;

    @Autowired
    private TournamentMatchParticipantRepository matchParticipantRepository;

    @Autowired
    private UserDailyProgressRepository udpRepository;

    /**
     * Returns a summary of upcoming tournaments for the Home
     * mode-card live hint (HM-P1-1). "Upcoming" maps to LOBBY status
     * (open for joining) since the entity has no scheduled startsAt
     * field — the FE renders "{count} đấu trường đang mở" or hides
     * the hint when count is 0.
     */
    public Map<String, Object> getUpcomingTournaments() {
        List<Tournament> lobby = tournamentRepository.findByStatus(Tournament.Status.LOBBY);
        Map<String, Object> response = new HashMap<>();
        response.put("count", lobby.size());
        if (lobby.isEmpty()) {
            response.put("next", null);
        } else {
            // Pick the most recently created lobby tournament — most
            // likely the one users would discover first on /tournaments.
            Tournament next = lobby.stream()
                    .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                    .orElse(lobby.get(0));
            Map<String, Object> nextInfo = new LinkedHashMap<>();
            nextInfo.put("id", next.getId());
            nextInfo.put("name", next.getName());
            nextInfo.put("bracketSize", next.getBracketSize());
            nextInfo.put("createdAt", next.getCreatedAt());
            response.put("next", nextInfo);
        }
        return response;
    }

    public Map<String, Object> createTournament(String name, User creator, int bracketSize) {
        Map<String, Object> result = new HashMap<>();

        // Validate bracketSize is power of 2 (4, 8, 16, 32)
        if (bracketSize < 4 || bracketSize > 32 || (bracketSize & (bracketSize - 1)) != 0) {
            result.put("error", "bracketSize must be a power of 2 (4, 8, 16, or 32)");
            return result;
        }

        Tournament tournament = new Tournament(
                UUID.randomUUID().toString(), name, creator, bracketSize);
        tournament.setStatus(Tournament.Status.LOBBY);
        tournamentRepository.save(tournament);

        // Auto-join the creator
        TournamentParticipant creatorParticipant = new TournamentParticipant(
                UUID.randomUUID().toString(), tournament, creator);
        participantRepository.save(creatorParticipant);

        result.put("tournamentId", tournament.getId());
        result.put("name", tournament.getName());
        result.put("bracketSize", tournament.getBracketSize());
        result.put("status", tournament.getStatus().name());
        result.put("creatorId", creator.getId());
        return result;
    }

    public Map<String, Object> joinTournament(String tournamentId, User user) {
        Map<String, Object> result = new HashMap<>();

        Optional<Tournament> optTournament = tournamentRepository.findById(tournamentId);
        if (optTournament.isEmpty()) {
            result.put("error", "Tournament not found");
            return result;
        }

        Tournament tournament = optTournament.get();

        if (tournament.getStatus() != Tournament.Status.LOBBY) {
            result.put("error", "Tournament is not in LOBBY status");
            return result;
        }

        long currentCount = participantRepository.countByTournamentId(tournamentId);
        if (currentCount >= tournament.getBracketSize()) {
            result.put("error", "Tournament is full");
            return result;
        }

        Optional<TournamentParticipant> existing = participantRepository
                .findByTournamentIdAndUserId(tournamentId, user.getId());
        if (existing.isPresent()) {
            result.put("error", "Already joined this tournament");
            return result;
        }

        TournamentParticipant participant = new TournamentParticipant(
                UUID.randomUUID().toString(), tournament, user);
        participantRepository.save(participant);

        result.put("tournamentId", tournamentId);
        result.put("userId", user.getId());
        result.put("participantCount", currentCount + 1);
        result.put("bracketSize", tournament.getBracketSize());
        return result;
    }

    public Map<String, Object> startTournament(String tournamentId, String userId) {
        Map<String, Object> result = new HashMap<>();

        Optional<Tournament> optTournament = tournamentRepository.findById(tournamentId);
        if (optTournament.isEmpty()) {
            result.put("error", "Tournament not found");
            return result;
        }

        Tournament tournament = optTournament.get();

        // Only creator can start
        if (!tournament.getCreator().getId().equals(userId)) {
            result.put("error", "Only the creator can start the tournament");
            return result;
        }

        if (!tournament.canStart()) {
            result.put("error", "Tournament cannot be started");
            return result;
        }

        List<TournamentParticipant> participants = participantRepository.findByTournamentId(tournamentId);
        if (participants.size() < 4) {
            result.put("error", "Need at least 4 participants to start");
            return result;
        }

        // FIX-003: Seed by all-time points (highest → seed 1). Same points → random.
        seedParticipantsByPoints(participants);
        for (int i = 0; i < participants.size(); i++) {
            participants.get(i).setSeed(i + 1);
            participantRepository.save(participants.get(i));
        }

        // Generate round 1 bracket
        int bracketSize = tournament.getBracketSize();
        int matchesInRound1 = bracketSize / 2;

        // Create seeded slots: pair seed 1 vs last, 2 vs second-to-last, etc.
        // Slots filled by participants; empty slots get byes
        List<TournamentParticipant> seededSlots = new ArrayList<>(Collections.nCopies(bracketSize, null));
        for (TournamentParticipant p : participants) {
            seededSlots.set(p.getSeed() - 1, p);
        }

        for (int i = 0; i < matchesInRound1; i++) {
            TournamentParticipant player1 = seededSlots.get(i);
            TournamentParticipant player2 = seededSlots.get(bracketSize - 1 - i);

            TournamentMatch match = new TournamentMatch(
                    UUID.randomUUID().toString(), tournament, 1, i);

            boolean isBye = (player1 == null || player2 == null);
            match.setBye(isBye);

            if (isBye) {
                // Auto-win for the present player
                TournamentParticipant winner = player1 != null ? player1 : player2;
                if (winner != null) {
                    match.setStatus(TournamentMatch.Status.COMPLETED);
                    match.setWinnerId(winner.getUser().getId());
                    match.setEndedAt(LocalDateTime.now());
                } else {
                    // Both slots empty - should not happen with >= 2 participants
                    match.setStatus(TournamentMatch.Status.COMPLETED);
                }
            } else {
                match.setStatus(TournamentMatch.Status.PENDING);
            }

            matchRepository.save(match);

            // Create match participants for non-bye matches
            if (!isBye) {
                TournamentMatchParticipant mp1 = new TournamentMatchParticipant(
                        UUID.randomUUID().toString(), match, player1.getUser());
                TournamentMatchParticipant mp2 = new TournamentMatchParticipant(
                        UUID.randomUUID().toString(), match, player2.getUser());
                matchParticipantRepository.save(mp1);
                matchParticipantRepository.save(mp2);
            } else {
                // For bye matches, create a single participant entry for the present player
                TournamentParticipant winner = player1 != null ? player1 : player2;
                if (winner != null) {
                    TournamentMatchParticipant mp = new TournamentMatchParticipant(
                            UUID.randomUUID().toString(), match, winner.getUser());
                    mp.setIsWinner(true);
                    matchParticipantRepository.save(mp);
                }
            }
        }

        tournament.setStatus(Tournament.Status.IN_PROGRESS);
        tournament.setCurrentRound(1);
        tournament.setStartedAt(LocalDateTime.now());
        tournamentRepository.save(tournament);

        // Check if all round 1 matches are already done (all byes except one real match scenario)
        checkAndAdvanceRound(tournament);

        result.put("tournamentId", tournamentId);
        result.put("status", tournament.getStatus().name());
        result.put("currentRound", tournament.getCurrentRound());
        result.put("participantCount", participants.size());
        result.put("totalRounds", tournament.getTotalRounds());
        return result;
    }

    public Map<String, Object> getBracket(String tournamentId) {
        Map<String, Object> result = new HashMap<>();

        Optional<Tournament> optTournament = tournamentRepository.findById(tournamentId);
        if (optTournament.isEmpty()) {
            result.put("error", "Tournament not found");
            return result;
        }

        Tournament tournament = optTournament.get();
        List<TournamentMatch> allMatches = matchRepository.findByTournamentId(tournamentId);

        // Group by round
        Map<Integer, List<Map<String, Object>>> rounds = new LinkedHashMap<>();
        for (TournamentMatch match : allMatches) {
            int round = match.getRoundNumber();
            rounds.computeIfAbsent(round, k -> new ArrayList<>());

            Map<String, Object> matchInfo = new HashMap<>();
            matchInfo.put("matchId", match.getId());
            matchInfo.put("roundNumber", match.getRoundNumber());
            matchInfo.put("matchIndex", match.getMatchIndex());
            matchInfo.put("status", match.getStatus().name());
            matchInfo.put("winnerId", match.getWinnerId());
            matchInfo.put("isBye", match.isBye());

            List<TournamentMatchParticipant> matchParticipants =
                    matchParticipantRepository.findByMatchId(match.getId());
            List<Map<String, Object>> participantInfos = new ArrayList<>();
            for (TournamentMatchParticipant mp : matchParticipants) {
                Map<String, Object> pInfo = new HashMap<>();
                pInfo.put("userId", mp.getUser().getId());
                pInfo.put("userName", mp.getUser().getName());
                pInfo.put("lives", mp.getLives());
                pInfo.put("score", mp.getScore());
                pInfo.put("isWinner", mp.getIsWinner());
                participantInfos.add(pInfo);
            }
            matchInfo.put("participants", participantInfos);
            rounds.get(round).add(matchInfo);
        }

        result.put("tournamentId", tournamentId);
        result.put("name", tournament.getName());
        result.put("status", tournament.getStatus().name());
        result.put("currentRound", tournament.getCurrentRound());
        result.put("totalRounds", tournament.getTotalRounds());
        result.put("rounds", rounds);
        return result;
    }

    public void advanceWinner(TournamentMatch completedMatch) {
        Tournament tournament = completedMatch.getTournament();
        String winnerId = completedMatch.getWinnerId();

        if (winnerId == null) {
            log.warn("advanceWinner called but no winnerId set on match {}", completedMatch.getId());
            return;
        }

        // Mark loser as eliminated
        List<TournamentMatchParticipant> matchParticipants =
                matchParticipantRepository.findByMatchId(completedMatch.getId());
        for (TournamentMatchParticipant mp : matchParticipants) {
            if (!mp.getUser().getId().equals(winnerId)) {
                mp.setIsWinner(false);
                matchParticipantRepository.save(mp);

                // Mark tournament participant as eliminated
                Optional<TournamentParticipant> optParticipant = participantRepository
                        .findByTournamentIdAndUserId(tournament.getId(), mp.getUser().getId());
                if (optParticipant.isPresent()) {
                    TournamentParticipant tp = optParticipant.get();
                    tp.setEliminated(true);
                    participantRepository.save(tp);
                }
            } else {
                mp.setIsWinner(true);
                matchParticipantRepository.save(mp);
            }
        }

        checkAndAdvanceRound(tournament);
    }

    private void checkAndAdvanceRound(Tournament tournament) {
        int currentRound = tournament.getCurrentRound();
        List<TournamentMatch> roundMatches = matchRepository
                .findByTournamentIdAndRoundNumber(tournament.getId(), currentRound);

        boolean allDone = roundMatches.stream()
                .allMatch(m -> m.getStatus() == TournamentMatch.Status.COMPLETED);

        if (!allDone) {
            return;
        }

        // Collect winners from this round
        List<String> winnerIds = roundMatches.stream()
                .map(TournamentMatch::getWinnerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        // Check if tournament is done (final match)
        if (winnerIds.size() <= 1) {
            // Tournament completed
            tournament.setStatus(Tournament.Status.COMPLETED);
            tournament.setEndedAt(LocalDateTime.now());
            tournamentRepository.save(tournament);

            // Set final rank for the winner
            if (!winnerIds.isEmpty()) {
                Optional<TournamentParticipant> optWinner = participantRepository
                        .findByTournamentIdAndUserId(tournament.getId(), winnerIds.get(0));
                optWinner.ifPresent(tp -> {
                    tp.setFinalRank(1);
                    participantRepository.save(tp);
                });
            }
            return;
        }

        // Create next round matches
        int nextRound = currentRound + 1;
        int matchesInNextRound = winnerIds.size() / 2;

        for (int i = 0; i < matchesInNextRound; i++) {
            String player1Id = winnerIds.get(i * 2);
            String player2Id = (i * 2 + 1 < winnerIds.size()) ? winnerIds.get(i * 2 + 1) : null;

            TournamentMatch nextMatch = new TournamentMatch(
                    UUID.randomUUID().toString(), tournament, nextRound, i);

            if (player2Id == null) {
                // Bye - auto-win
                nextMatch.setBye(true);
                nextMatch.setStatus(TournamentMatch.Status.COMPLETED);
                nextMatch.setWinnerId(player1Id);
                nextMatch.setEndedAt(LocalDateTime.now());
            } else {
                nextMatch.setStatus(TournamentMatch.Status.PENDING);
            }

            matchRepository.save(nextMatch);

            if (player2Id != null) {
                // Create match participants
                User user1 = findUserFromParticipants(tournament.getId(), player1Id);
                User user2 = findUserFromParticipants(tournament.getId(), player2Id);

                if (user1 != null) {
                    TournamentMatchParticipant mp1 = new TournamentMatchParticipant(
                            UUID.randomUUID().toString(), nextMatch, user1);
                    matchParticipantRepository.save(mp1);
                }
                if (user2 != null) {
                    TournamentMatchParticipant mp2 = new TournamentMatchParticipant(
                            UUID.randomUUID().toString(), nextMatch, user2);
                    matchParticipantRepository.save(mp2);
                }
            } else {
                // Bye match participant
                User user1 = findUserFromParticipants(tournament.getId(), player1Id);
                if (user1 != null) {
                    TournamentMatchParticipant mp = new TournamentMatchParticipant(
                            UUID.randomUUID().toString(), nextMatch, user1);
                    mp.setIsWinner(true);
                    matchParticipantRepository.save(mp);
                }
            }
        }

        tournament.setCurrentRound(nextRound);
        tournamentRepository.save(tournament);

        // Recursively check if the new round is already complete (all byes)
        checkAndAdvanceRound(tournament);
    }

    /**
     * FIX-003: Seed participants by all-time points (highest first).
     * Participants with equal points are randomized among themselves.
     */
    private void seedParticipantsByPoints(List<TournamentParticipant> participants) {
        // Compute all-time points for each participant
        Map<String, Integer> pointsMap = new HashMap<>();
        for (TournamentParticipant p : participants) {
            String userId = p.getUser().getId();
            int totalPoints = udpRepository.findByUserIdOrderByDateDesc(userId).stream()
                    .mapToInt(udp -> udp.getPointsCounted() != null ? udp.getPointsCounted() : 0)
                    .sum();
            pointsMap.put(userId, totalPoints);
        }

        // Shuffle first so equal-points participants get random order
        Collections.shuffle(participants);
        // Then stable-sort descending by points
        participants.sort((a, b) -> {
            int pa = pointsMap.getOrDefault(a.getUser().getId(), 0);
            int pb = pointsMap.getOrDefault(b.getUser().getId(), 0);
            return Integer.compare(pb, pa); // descending
        });

        log.info("[TOURNAMENT] Seeded {} participants by points: {}",
                participants.size(),
                participants.stream()
                        .map(p -> p.getUser().getName() + "(" + pointsMap.get(p.getUser().getId()) + ")")
                        .collect(Collectors.joining(", ")));
    }

    private User findUserFromParticipants(String tournamentId, String userId) {
        return participantRepository.findByTournamentIdAndUserId(tournamentId, userId)
                .map(TournamentParticipant::getUser)
                .orElse(null);
    }

    public Map<String, Object> forfeitMatch(String tournamentId, String matchId, String userId) {
        Map<String, Object> result = new HashMap<>();

        Optional<TournamentMatch> optMatch = matchRepository.findById(matchId);
        if (optMatch.isEmpty()) {
            result.put("error", "Match not found");
            return result;
        }

        TournamentMatch match = optMatch.get();
        if (!match.getTournament().getId().equals(tournamentId)) {
            result.put("error", "Match does not belong to this tournament");
            return result;
        }

        if (match.getStatus() == TournamentMatch.Status.COMPLETED) {
            result.put("error", "Match is already completed");
            return result;
        }

        List<TournamentMatchParticipant> matchParticipants =
                matchParticipantRepository.findByMatchId(matchId);

        // Find the forfeiting player and the opponent
        TournamentMatchParticipant forfeitingPlayer = null;
        TournamentMatchParticipant opponent = null;
        for (TournamentMatchParticipant mp : matchParticipants) {
            if (mp.getUser().getId().equals(userId)) {
                forfeitingPlayer = mp;
            } else {
                opponent = mp;
            }
        }

        if (forfeitingPlayer == null) {
            result.put("error", "User is not a participant in this match");
            return result;
        }

        if (opponent == null) {
            result.put("error", "No opponent found");
            return result;
        }

        // Set opponent as winner
        forfeitingPlayer.setIsWinner(false);
        forfeitingPlayer.setLives(0);
        matchParticipantRepository.save(forfeitingPlayer);

        opponent.setIsWinner(true);
        matchParticipantRepository.save(opponent);

        match.setStatus(TournamentMatch.Status.COMPLETED);
        match.setWinnerId(opponent.getUser().getId());
        match.setEndedAt(LocalDateTime.now());
        matchRepository.save(match);

        // Advance bracket
        advanceWinner(match);

        result.put("matchId", matchId);
        result.put("winnerId", opponent.getUser().getId());
        result.put("forfeitedBy", userId);
        return result;
    }

    public Optional<Tournament> findById(String tournamentId) {
        return tournamentRepository.findById(tournamentId);
    }
}
