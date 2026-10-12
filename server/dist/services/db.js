"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthClient = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
// A mock client if keys are not provided yet to avoid crashing the dev server
exports.supabase = supabaseUrl && supabaseKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey)
    : null;
// Creates a client authenticated as the user using their JWT
const getAuthClient = (jwt) => {
    if (!supabaseUrl || !supabaseKey)
        return null;
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${jwt}`,
            },
        },
    });
};
exports.getAuthClient = getAuthClient;
if (!exports.supabase) {
    console.warn("⚠️ SUPABASE_URL and SUPABASE_ANON_KEY are not set. Database features will fail.");
}
