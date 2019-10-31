import express from "express";
import { usersRouter } from "./users";
import { postsRouter } from "./posts";
import { Policy } from "../../src/endpoint";

export const app = express();

app.get("/", (req, res) => res.status(200));
app.get("/about", Policy.create("about only", "backend"), (req, res) =>
  res.status(200)
);
app.get("/contact-us", (req, res) => res.status(200));

app.get("/users", usersRouter);

app.use(
  Policy.create("usersfake and posts", "backend"),
  Policy.create("usersfake and posts again", "backend")
);
app.use(
  "/usersFaker/:userId?-?:userIds/aa?fr(aa|rew)/werf",
  Policy.create("usersfake only", "backend"),
  usersRouter
);
app.get(
  "/posts",
  Policy.create("posts only", "backend"),
  Policy.create("posts only again", "backend"),
  postsRouter
);
