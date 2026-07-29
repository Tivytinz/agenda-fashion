process.env.GOOGLE_CLIENT_ID =
  "cliente.apps.googleusercontent.com";

const mockVerifyIdToken =
  jest.fn();

jest.mock(
  "google-auth-library",
  () => ({
    OAuth2Client:
      jest.fn(() => ({
        verifyIdToken:
          mockVerifyIdToken,
      })),
  })
);

const googleIdentityService =
  require(
    "../src/services/googleIdentityService"
  );

describe(
  "Google Identity Service",
  () => {
    beforeEach(() => {
      mockVerifyIdToken
        .mockReset();
    });

    test(
      "valida o ID token com o client ID correto",
      async () => {
        mockVerifyIdToken
          .mockResolvedValue({
            getPayload: () => ({
              sub:
                "google-sub-123",
              email:
                "VICTOR@GMAIL.COM",
              email_verified:
                true,
              name:
                "  Victor   Souza  ",
            }),
          });

        await expect(
          googleIdentityService
            .verificarCredencial(
              "id-token"
            )
        ).resolves.toEqual({
          googleSub:
            "google-sub-123",
          email:
            "victor@gmail.com",
          nome:
            "Victor Souza",
          emailAutoritativo:
            true,
        });

        expect(
          mockVerifyIdToken
        ).toHaveBeenCalledWith({
          idToken:
            "id-token",
          audience:
            process.env
              .GOOGLE_CLIENT_ID,
        });
      }
    );

    test(
      "rejeita token inválido sem expor o erro interno",
      async () => {
        mockVerifyIdToken
          .mockRejectedValue(
            new Error(
              "invalid signature"
            )
          );

        await expect(
          googleIdentityService
            .verificarCredencial(
              "token-invalido"
            )
        ).rejects.toMatchObject({
          message:
            "Não foi possível validar sua conta Google.",
          statusCode: 401,
        });
      }
    );

    test(
      "rejeita e-mail não verificado",
      async () => {
        mockVerifyIdToken
          .mockResolvedValue({
            getPayload: () => ({
              sub:
                "google-sub-123",
              email:
                "victor@gmail.com",
              email_verified:
                false,
              name:
                "Victor Souza",
            }),
          });

        await expect(
          googleIdentityService
            .verificarCredencial(
              "id-token"
            )
        ).rejects.toMatchObject({
          message:
            "Sua conta Google precisa ter um e-mail verificado.",
          statusCode: 401,
        });
      }
    );
  }
);
