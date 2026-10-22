import { describe, expect, it, vi, beforeEach } from "vitest";

import { uploadAvatar } from "./uploadAvatar";
import { loadAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(),
  resolveActiveOrg: vi.fn(async () => ({ orgId: "org-1" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
}));

describe("uploadAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recusa usuário não autenticado", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(null);
    const fd = new FormData();
    const res = await uploadAvatar(fd);
    expect(res).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("recusa requisição sem arquivo", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue({ id: "user-1" } as any);
    const fd = new FormData();
    const res = await uploadAvatar(fd);
    expect(res).toEqual({ ok: false, error: "Nenhum arquivo enviado." });
  });

  it("recusa arquivo com formato inválido", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue({ id: "user-1" } as any);
    const fd = new FormData();
    const file = new File(["dummy"], "test.pdf", { type: "application/pdf" });
    fd.append("file", file);

    const res = await uploadAvatar(fd);
    expect(res).toEqual({
      ok: false,
      error: "Formato inválido. Envie PNG, JPG, WEBP ou GIF.",
    });
  });

  it("faz upload de imagem válida e atualiza usuário com sucesso", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue({ id: "user-1" } as any);

    const uploadMock = vi.fn(async () => ({ error: null }));
    const getPublicUrlMock = vi.fn(() => ({
      data: { publicUrl: "https://storage.test/avatars/user-1/foto.png" },
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
        })),
      },
    } as any);

    const updateUserMock = vi.fn(async () => ({ error: null }));
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        updateUser: updateUserMock,
      },
    } as any);

    const fd = new FormData();
    const file = new File(["bytes"], "foto.png", { type: "image/png" });
    fd.append("file", file);

    const res = await uploadAvatar(fd);
    expect(res).toEqual({
      ok: true,
      avatarUrl: "https://storage.test/avatars/user-1/foto.png",
    });
    expect(uploadMock).toHaveBeenCalled();
    expect(updateUserMock).toHaveBeenCalledWith({
      data: {
        avatar_url: "https://storage.test/avatars/user-1/foto.png",
      },
    });
  });
});
