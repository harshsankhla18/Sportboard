import {Router} from "express";
import {createMatch, listMatches} from "../controllers/matches.controllers.js";
import {commentaryRouter} from "./commentary.routes.js";
// import {ApiError} from "../utils/api-error.js";

export const matchRouter = Router();

matchRouter.get('/', listMatches);
matchRouter.post('/', createMatch);
matchRouter.use('/:id/commentary', commentaryRouter);