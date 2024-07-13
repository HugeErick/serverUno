const { z } =  require('zod');

const pswSchema = z.object({
  password: z.string().min(6).max(20).regex(/[A-Z]/, "must contain at least one uppercase letter")
    .regex(/[a-z]/, "must contain at least one lowercase letter")
    .regex(/[0-9]/, "must contain at least one number"),
});

const userSchema = z.object({
	username : z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, "invalid username format"),
	});

module.exports = { pswSchema, userSchema };
