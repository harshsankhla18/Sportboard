import {db} from "../db/db.js";
import {commentary, matches} from "../db/schema.js";
import ApiResponse from "../utils/api-response.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import {matchIdParamSchema} from "../validation/matches.js";
import {getScoreDelta} from "../utils/score-delta.js";
import {desc, eq, sql} from "drizzle-orm";

const MAX_LIMIT = 100;

const createCommentary = async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  const parsedBody = createCommentarySchema.safeParse(req.body);

  if (!parsedParams.success) {
    return res.status(400).json(
      new ApiResponse(400, parsedParams.error.issues, "Invalid match id"),
    );
  }
  if (!parsedBody.success) {
    return res.status(400).json(
      new ApiResponse(400, parsedBody.error.issues, "Invalid payload"),
    );
  }

  try {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, parsedParams.data.id))
      .limit(1);

    if (!match) {
      return res.status(404).json(
        new ApiResponse(404, null, "Match not found"),
      );
    }

    const scoreDelta = getScoreDelta(match, parsedBody.data);
    const {scoreDelta: _scoreDelta, ...commentaryData} = parsedBody.data;
    const metadata = {
      ...(commentaryData.metadata ?? {}),
      ...(scoreDelta ? {scoreDelta} : {}),
    };
    const [createdCommentary] = await db
      .insert(commentary)
      .values({
        ...commentaryData,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        matchId: parsedParams.data.id,
      })
      .returning();

    if (scoreDelta) {
      const [updatedMatch] = await db
        .update(matches)
        .set({
          homeScore: sql`${matches.homeScore} + ${scoreDelta.home}`,
          awayScore: sql`${matches.awayScore} + ${scoreDelta.away}`,
        })
        .where(eq(matches.id, match.id))
        .returning();

      if (res.app.locals.broadcastMatchScoreUpdated) {
        res.app.locals.broadcastMatchScoreUpdated(updatedMatch);
      }
    }

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(createdCommentary.matchId, createdCommentary);
    }

    return res
      .status(201)
      .json(new ApiResponse(201, createdCommentary));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, error.message));
  }
};

const listCommentary = async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);

  if (!parsedParams.success) {
    return res.status(400).json(
      new ApiResponse(400, parsedParams.error.issues, "Invalid match id"),
    );
  }
  if (!parsedQuery.success) {
    return res.status(400).json(
      new ApiResponse(400, parsedQuery.error.issues, "Invalid query"),
    );
  }

  try {
    const requestedLimit = Number(parsedQuery.data.limit ?? MAX_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const events = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, parsedParams.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json(new ApiResponse(200, events));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, error.message));
  }
};

export {createCommentary, listCommentary};
