#!/bin/bash
touch /tmp/init_started
# ==========================
# PostgreSQL installation
# ==========================
yum update -y
yum install postgresql-server postgresql-contrib -y
postgresql-setup initdb
systemctl start postgresql
systemctl enable postgresql
echo "host all all 0.0.0.0/0 md5" >> /var/lib/pgsql/data/pg_hba.conf
echo "listen_addresses = '*'" >> /var/lib/pgsql/data/postgresql.conf
sudo systemctl restart postgresql
# ==========================
# PostgreSQL init
# ==========================
useradd dbuser
sudo -i -u postgres bash << EOF
createuser dbuser
createdb friendshipdb -O dbuser 
psql -c "ALTER USER dbuser PASSWORD 'myPassw0rd!';"
EOF
touch /tmp/postgresql_done

# ==========================
# nginx installation
# ==========================
dnf -y update
dnf -y install nginx
rm -f /usr/share/nginx/html/index.html
echo "Hello world from `hostname`" > /usr/share/nginx/html/index.html
chmod go+r /usr/share/nginx/html/index.html
systemctl enable nginx
systemctl start nginx
systemctl status nginx
touch /tmp/nginx_done

touch /tmp/init_done