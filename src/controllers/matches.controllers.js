import {createMatchSchema} from "../validation/matches.js";
import ApiResponse from "../utils/api-response.js";
import {db} from "../db/db.js";
import {matches} from "../db/schema.js";
import {getMatchStatus} from "../utils/match-status.js";

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
    }
    catch (error) {
        console.log("ERROR:");
        console.dir(error, { depth: null });

        console.log("CAUSE:");
        console.dir(error.cause, { depth: null });

        return res.status(500).json({
            message: error.cause?.message || error.message,
            code: error.cause?.code,
            detail: error.cause?.detail,
        });
    }
    // catch (error) {
    //     // const databaseMessage = error.cause?.message;
    //     return res.status(500).json(
    //         new ApiResponse(500, null, error.message),
    //     );
    // }
};

export default createMatch;