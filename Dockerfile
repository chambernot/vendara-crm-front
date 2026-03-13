FROM nginx:alpine

# Copiar arquivos da aplicação
COPY dist/vendara/browser /usr/share/nginx/html

# Remover configuração padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Executar nginx
CMD ["nginx", "-g", "daemon off;"]
