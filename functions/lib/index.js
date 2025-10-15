"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthRevoke = exports.oauthRegister = exports.oauthCallback = exports.oauthToken = exports.oauthAuthorize = exports.oauthMetadata = void 0;
const admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
// Export OAuth functions only
// generateBearerToken is internal - only used by oauthCallback
var oauthMetadata_1 = require("./oauthMetadata");
Object.defineProperty(exports, "oauthMetadata", { enumerable: true, get: function () { return oauthMetadata_1.oauthMetadata; } });
Object.defineProperty(exports, "oauthAuthorize", { enumerable: true, get: function () { return oauthMetadata_1.oauthAuthorize; } });
var oauthToken_1 = require("./oauthToken");
Object.defineProperty(exports, "oauthToken", { enumerable: true, get: function () { return oauthToken_1.oauthToken; } });
var oauthCallback_1 = require("./oauthCallback");
Object.defineProperty(exports, "oauthCallback", { enumerable: true, get: function () { return oauthCallback_1.oauthCallback; } });
var oauthRegister_1 = require("./oauthRegister");
Object.defineProperty(exports, "oauthRegister", { enumerable: true, get: function () { return oauthRegister_1.oauthRegister; } });
var oauthRevoke_1 = require("./oauthRevoke");
Object.defineProperty(exports, "oauthRevoke", { enumerable: true, get: function () { return oauthRevoke_1.oauthRevoke; } });
//# sourceMappingURL=index.js.map