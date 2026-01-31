// Script para testar rate limit do Supabase
// Executar no console do browser (F12)

const testRateLimit = async () => {
    const { supabase } = await import('./lib/supabase');

    console.log('🔍 Testando envio de email de reset...');

    const { data, error } = await supabase.auth.resetPasswordForEmail(
        'lplay.2026x@gmail.com',
        { redirectTo: `${window.location.origin}/reset-password` }
    );

    if (error) {
        console.error('❌ Erro:', error);
        console.log('📋 Detalhes:', {
            message: error.message,
            status: error.status,
            name: error.name
        });

        if (error.message.toLowerCase().includes('rate limit')) {
            console.warn('⚠️ RATE LIMIT ATINGIDO!');
            console.log('Aguarde ~1 hora antes de tentar novamente');
        }
    } else {
        console.log('✅ Email enviado com sucesso!', data);
    }
};

testRateLimit();
