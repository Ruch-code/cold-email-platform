import { createHandler } from '@netlify/functions';
import handler from '../functions/auth-admin-login.js';

export default createHandler(handler);