import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from "lucide-react";

export default function ResetSenha() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Link invalido ou expirado. Solicite um novo link de recuperacao.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error ?? "Erro ao redefinir senha.");
      }
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">CobraPro</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Gestao de Cobranças</p>
        </div>

        <div className="bg-[#111111] border border-[#1f2937] rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Senha redefinida!</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Sua senha foi alterada com sucesso. Agora voce pode entrar com a nova senha.
              </p>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold"
              >
                Ir para o login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Criar nova senha</h2>
                <p className="text-gray-400 text-sm">
                  Escolha uma nova senha segura para sua conta CobraPro.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                    Nova senha
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pl-10 pr-10 bg-[#1a1a1a] border-[#2d3748] text-white placeholder:text-gray-600 focus:border-green-500 focus:ring-green-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm" className="text-gray-300 text-sm font-medium">
                    Confirmar nova senha
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-[#1a1a1a] border-[#2d3748] text-white placeholder:text-gray-600 focus:border-green-500 focus:ring-green-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= i * 3
                              ? password.length >= 12
                                ? "bg-green-500"
                                : password.length >= 8
                                ? "bg-yellow-500"
                                : "bg-red-500"
                              : "bg-[#2d3748]"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {password.length < 6
                        ? "Senha muito curta"
                        : password.length < 8
                        ? "Senha fraca"
                        : password.length < 12
                        ? "Senha razoavel"
                        : "Senha forte"}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !password || !confirm || !token}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold h-11 mt-2"
                >
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setLocation("/recuperar-senha")}
                  className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                  Solicitar novo link de recuperacao
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
