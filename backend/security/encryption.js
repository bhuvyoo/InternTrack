const crypto = require("crypto");

// 32-byte key required for AES-256
const ENCRYPTION_KEY = crypto
    .createHash("sha256")
    .update("interntrack-aes-256-secret-key")
    .digest();


function encryptData(data) {

    // Convert JavaScript object to JSON
    const plaintext = JSON.stringify(data);

    // Generate a unique IV for every encryption
    const iv = crypto.randomBytes(12);

    // Create AES-256-GCM cipher
    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        ENCRYPTION_KEY,
        iv
    );

    // Encrypt data
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {

        encryptedData:
            encrypted.toString("base64"),

        iv:
            iv.toString("base64"),

        authTag:
            authTag.toString("base64")

    };

}


function decryptData(payload) {

    const {

        encryptedData,
        iv,
        authTag

    } = payload;


    if (
        !encryptedData ||
        !iv ||
        !authTag
    ) {

        throw new Error(
            "Invalid encrypted payload"
        );

    }


    const decipher = crypto.createDecipheriv(

        "aes-256-gcm",

        ENCRYPTION_KEY,

        Buffer.from(iv, "base64")

    );


    decipher.setAuthTag(
        Buffer.from(authTag, "base64")
    );


    const decrypted = Buffer.concat([

        decipher.update(
            Buffer.from(
                encryptedData,
                "base64"
            )
        ),

        decipher.final()

    ]);


    return JSON.parse(
        decrypted.toString("utf8")
    );

}


module.exports = {

    encryptData,
    decryptData

};