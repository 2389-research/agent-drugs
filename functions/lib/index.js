"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJWT = void 0;
const admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
// Export functions
var generateCustomToken_1 = require("./generateCustomToken");
Object.defineProperty(exports, "generateJWT", { enumerable: true, get: function () { return generateCustomToken_1.generateJWT; } });
//# sourceMappingURL=index.js.map