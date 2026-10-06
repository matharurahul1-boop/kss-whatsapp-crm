process.env.DATABASE_URL ??= "postgresql://kss:kss_password@localhost:5432/kss_whatsapp_test?schema=public";
process.env.JWT_SECRET ??= "test-secret";
process.env.META_MODE ??= "mock";
process.env.WEBHOOK_VERIFY_TOKEN ??= "test_verify_token";
