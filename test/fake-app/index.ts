import express from "express";
import { usersRouter } from "./users";
import { postsRouter } from "./posts";
import { Policy } from "../../src/endpoint";

export const app = express();

app.get("/", (req, res) => res.status(200));
app.get("/about", Policy.create("XML8", "backend"), (req, res) =>
  res.status(200)
);
app.get("/contact-us", (req, res) => res.status(200));

app.get("/users", usersRouter);

app.use(Policy.create("XML4", "backend"), Policy.create("XML", "backend"));
app.use(
  "/usersFaker/:userId?-?:userIds/aa?fr(aa|rew)/werf",
  Policy.create("XML5", "backend"),
  usersRouter
);
app.get(
  "/posts",
  Policy.create("XML6", "backend"),
  Policy.create("XML7", "backend"),
  postsRouter
);
