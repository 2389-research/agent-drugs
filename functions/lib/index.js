"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthAuthorize = exports.oauthMetadata = exports.generateJWT = void 0;
const admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
// Export functions
var generateCustomToken_1 = require("./generateCustomToken");
Object.defineProperty(exports, "generateJWT", { enumerable: true, get: function () { return generateCustomToken_1.generateJWT; } });
var oauthMetadata_1 = require("./oauthMetadata");
Object.defineProperty(exports, "oauthMetadata", { enumerable: true, get: function () { return oauthMetadata_1.oauthMetadata; } });
Object.defineProperty(exports, "oauthAuthorize", { enumerable: true, get: function () { return oauthMetadata_1.oauthAuthorize; } });
//# sourceMappingURL=index.js.map