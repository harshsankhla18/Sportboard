import {Router} from "express";
import apiResponse from "../utils/api-response.js";
import {createMatch, listMatches} from "../controllers/matches.controllers.js";
// import {ApiError} from "../utils/api-error.js";

export const matchRouter = Router();

matchRouter.get('/', listMatches);
matchRouter.post('/', createMatch);