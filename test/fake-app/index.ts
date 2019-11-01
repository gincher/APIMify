import express from 'express';
import { usersRouter } from './users';
import { postsRouter } from './posts';
import { Policy } from '../../src/main';

export const app = express();

app.get('/', (req, res) => res.status(200));
app.get('/about', (req, res) => res.status(200));
app.get('/contact-us', (req, res) => res.status(200));

app.get('/users', usersRouter);

app.use('/usersFaker/:userId?-?:userIds/aa?fr(aa|rew)/werf', usersRouter);
app.get('/posts', postsRouter);
