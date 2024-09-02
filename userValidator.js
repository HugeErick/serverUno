const { z } =  require('zod');

const pswSchema = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(30, "Password must not exceed 30 characters"),
});

const userSchema = z.object({
	username : z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, "invalid username format"),
	});

module.exports = { pswSchema, userSchema };
