export interface User {
  email: string;
  id: string;
  name?: string;
  defaultWorkspaceId?: string; // ID do workspace padrão do usuário
  // Campos de expiração de conta
  accountExpiresAt?: string | null; // Data de expiração da conta (ISO 8601)
  accountStatus?: 'ACTIVE' | 'TRIAL' | 'EXPIRED'; // Status da conta
  accountPlan?: 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE'; // Plano da conta
  daysRemaining?: number | null; // Dias restantes até expirar (null se não expira)
}

export interface OnboardingData {
  businessType: 'pf' | 'mei' | 'loja';
  products: string[];
  objective: string;
  completedAt: string;
}

/**
 * DTO para enviar ao backend no onboarding
 */
export interface OnboardingCompleteDto {
  goal: string; // Objetivo (mapeado de objective)
  sellTypes: string[]; // Tipos de venda (mapeado de products)
  workspaceName: string; // Nome do workspace a ser criado
}

/**
 * DTO para login via API
 */
export interface LoginDto {
  email: string;
  password?: string; // Senha opcional para autenticação
}

/**
 * Resposta da API para login/auth
 */
export interface AuthResponse {
  token: string;
  user: User;
  onboardingComplete?: boolean;
  hasWorkspaces?: boolean;
  defaultWorkspaceId?: string; // Atalho para user.defaultWorkspaceId
}
