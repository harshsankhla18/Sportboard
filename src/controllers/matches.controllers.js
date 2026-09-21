import {createMatchSchema, listMatchesQuerySchema} from "../validation/matches.js";
import ApiResponse from "../utils/api-response.js";
import {db} from "../db/db.js";
import {matches} from "../db/schema.js";
import {getMatchStatus} from "../utils/match-status.js";
import {desc} from "drizzle-orm";

const createMatch = async (req, res) => {
    const parsedData = createMatchSchema.safeParse(req.body);

    if (!parsedData.success) {
        return res.status(400).json(
            new ApiResponse(400, parsedData.error.issues, "Invalid payload"),
        );
    }
    try {
        const event = await db
            .insert(matches)
            .values({
                ...parsedData.data,
                startTime: new Date(parsedData.data.startTime),
                endTime: new Date(parsedData.data.endTime),
                homeScore: parsedData.data.homeScore ?? 0,
                awayScore: parsedData.data.awayScore ?? 0,
                status: getMatchStatus(
                    parsedData.data.startTime,
                    parsedData.data.endTime,
                ),
            })
            .returning();

        return res.status(201).json(new ApiResponse(201, event));
    }catch (error) {
        // const databaseMessage = error.cause?.message;
        return res.status(500).json(
            new ApiResponse(500, null, error.message),
        );
    }
};
 const  listMatches = async (req,res) => {
     const parsedData = listMatchesQuerySchema.safeParse(req.body);
     if (!parsedData.success) {
         return res.status(400).json(
             new ApiResponse(400, parsedData.error.issues, "Invalid payload"),
         );
     }
     try{
         const limit = Math.min(parsedData.data.limit ?? 50,100);
         const event = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit)
         return res.status(200).json(new ApiResponse(200, event, "Success"));
     }catch(error){
         res.status(500).json(new ApiResponse(500, null, error.message));
     }
 }
export {createMatch, listMatches};