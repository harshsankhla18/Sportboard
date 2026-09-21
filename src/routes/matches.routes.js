import {Router} from "express";
import apiResponse from "../utils/api-response.js";
import createMatch from "../controllers/matches.controllers.js";
// import {ApiError} from "../utils/api-error.js";

export const matchRouter = Router();

matchRouter.get('/', (req, res) => {
    res.status(200).json(new apiResponse(200,"Hello from matchRouter"));
})
matchRouter.post('/', createMatch);