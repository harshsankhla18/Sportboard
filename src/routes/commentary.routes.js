import {Router} from "express";
import {
  createCommentary,
  listCommentary,
} from "../controllers/commentary.controllers.js";

export const commentaryRouter = Router({mergeParams: true});

commentaryRouter.get("/", listCommentary);
commentaryRouter.post("/", createCommentary);
