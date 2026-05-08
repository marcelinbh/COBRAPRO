import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function RecuperarSenha() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error ?? "Erro ao solicitar recuperação de senha.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">CobraPro</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Gestão de Cobranças</p>
        </div>

        <div className="bg-[#111111] border border-[#1f2937] rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">E-mail enviado!</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Se o e-mail <strong className="text-white">{email}</strong> estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Verifique também a pasta de spam ou lixo eletrônico.
              </p>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold"
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Recuperar senha</h2>
                <p className="text-gray-400 text-sm">
                  Informe seu e-mail cadastrado e enviaremos as instruções para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-gray-300 text-sm font-medium">
                    E-mail
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-[#1a1a1a] border-[#2d3748] text-white placeholder:text-gray-600 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold h-11 mt-2"
                >
                  {loading ? "Enviando..." : "Enviar instruções"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setLocation("/login")}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm mx-auto transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
