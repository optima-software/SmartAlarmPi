#!/usr/bin/env bash

# This is an installer script for SmartAlarmPi. It works well enough
# that it can detect if you have Node installed, run a binary script
# and then download and run SmartAlarmPi.

echo -e "\e[0m"

# Define the tested version of Node.js.
NODE_TESTED="v5.1.0"

# Determine which Pi is running.
ARM=$(uname -m) 

# Check the Raspberry Pi version.
if [ "$ARM" != "armv7l" ]; then
	echo -e "\e[91mSorry, your Raspberry Pi is not supported."
	echo -e "\e[91mPlease run SmartAlarmPi on a Raspberry Pi 2 or 3."
	echo -e "\e[91mIf this is a Pi Zero, you are in the same boat as the original Raspberry Pi. You must run in server only mode."
	exit;
fi

# Define helper methods.
function version_gt() { test "$(echo "$@" | tr " " "\n" | sort -V | head -n 1)" != "$1"; }
function command_exists () { type "$1" &> /dev/null ;}

# Update before first apt-get
echo -e "\e[96mUpdating packages ...\e[90m"
sudo apt-get update || echo -e "\e[91mUpdate failed, carrying on installation ...\e[90m"

# Installing helper tools
echo -e "\e[96mInstalling helper tools ...\e[90m"
sudo apt-get install curl wget git build-essential unzip || exit

# Check if we need to install or upgrade Node.js.
echo -e "\e[96mCheck current Node installation ...\e[0m"
NODE_INSTALL=false
if command_exists node; then
	echo -e "\e[0mNode currently installed. Checking version number.";
	NODE_CURRENT=$(node -v)
	echo -e "\e[0mMinimum Node version: \e[1m$NODE_TESTED\e[0m"
	echo -e "\e[0mInstalled Node version: \e[1m$NODE_CURRENT\e[0m"
	if version_gt $NODE_TESTED $NODE_CURRENT; then
		echo -e "\e[96mNode should be upgraded.\e[0m"
		NODE_INSTALL=true

		# Check if a node process is currenlty running.
		# If so abort installation.
		if pgrep "node" > /dev/null; then
			echo -e "\e[91mA Node process is currently running. Can't upgrade."
			echo "Please quit all Node processes and restart the installer."
			exit;
		fi

	else
		echo -e "\e[92mNo Node.js upgrade necessary.\e[0m"
	fi

else
	echo -e "\e[93mNode.js is not installed.\e[0m";
	NODE_INSTALL=true
fi

# Install or upgrade node if necessary.
if $NODE_INSTALL; then
	
	echo -e "\e[96mInstalling Node.js ...\e[90m"

	# Fetch the latest version of Node.js from the selected branch
	# The NODE_STABLE_BRANCH variable will need to be manually adjusted when a new branch is released. (e.g. 7.x)
	# Only tested (stable) versions are recommended as newer versions could break SmartAlarmPi.
	
	NODE_STABLE_BRANCH="6.x"
	curl -sL https://deb.nodesource.com/setup_$NODE_STABLE_BRANCH | sudo -E bash -
	sudo apt-get install -y nodejs
	echo -e "\e[92mNode.js installation Done!\e[0m"
fi

# Install SmartAlarmPi
cd ~
if [ -d "$HOME/SmartAlarmPi" ] ; then
	echo -e "\e[93mIt seems like SmartAlarmPi is already installed."
	echo -e "To prevent overwriting, the installer will be aborted."
	echo -e "Please rename the \e[1m~/SmartAlarmPi\e[0m\e[93m folder and try again.\e[0m"
	echo ""
	echo -e "If you want to upgrade your installation run \e[1m\e[97mgit pull\e[0m from the ~/SmartAlarmPi directory."
	echo ""
	exit;
fi

echo -e "\e[96mCloning SmartAlarmPi ...\e[90m"
if git clone https://github.com/optima-software/SmartAlarmPi.git; then
	echo -e "\e[92mCloning SmartAlarmPi Done!\e[0m"
else
	echo -e "\e[91mUnable to clone SmartAlarmPi."
	exit;
fi

cd ~/SmartAlarmPi  || exit
echo -e "\e[96mInstalling dependencies ...\e[90m"
if npm install; then 
	echo -e "\e[92mDependencies installation Done!\e[0m"
else
	echo -e "\e[91mUnable to install dependencies!"
	exit;
fi

# Use sample config for start SmartAlarmPi
cp config/config.js.sample config/config.js

# Check if plymouth is installed (default with PIXEL desktop environment), then install custom splashscreen.
echo -e "\e[96mCheck plymouth installation ...\e[0m"
if command_exists plymouth; then
	THEME_DIR="/usr/share/plymouth/themes"
	echo -e "\e[90mSplashscreen: Checking themes directory.\e[0m"
	if [ -d $THEME_DIR ]; then
		echo -e "\e[90mSplashscreen: Create theme directory if not exists.\e[0m"
		if [ ! -d $THEME_DIR/SmartAlarmPi ]; then
			sudo mkdir $THEME_DIR/SmartAlarmPi
		fi

		if sudo cp ~/SmartAlarmPi/splashscreen/splash.png $THEME_DIR/SmartAlarmPi/splash.png && sudo cp ~/SmartAlarmPi/splashscreen/SmartAlarmPi.plymouth $THEME_DIR/SmartAlarmPi/SmartAlarmPi.plymouth && sudo cp ~/SmartAlarmPi/splashscreen/SmartAlarmPi.script $THEME_DIR/SmartAlarmPi/SmartAlarmPi.script; then
			echo -e "\e[90mSplashscreen: Theme copied successfully.\e[0m"
			if sudo plymouth-set-default-theme -R SmartAlarmPi; then
				echo -e "\e[92mSplashscreen: Changed theme to SmartAlarmPi successfully.\e[0m"
			else
				echo -e "\e[91mSplashscreen: Couldn't change theme to SmartAlarmPi!\e[0m"
			fi
		else
			echo -e "\e[91mSplashscreen: Copying theme failed!\e[0m"
		fi
	else
		echo -e "\e[91mSplashscreen: Themes folder doesn't exist!\e[0m"
	fi
else
	echo -e "\e[93mplymouth is not installed.\e[0m";
fi

# Use pm2 control like a service SmartAlarmPi
read -p "Do you want use pm2 for auto starting of your SmartAlarmPi (y/n)?" choice
if [[ $choice =~ ^[Yy]$ ]]; then
    sudo npm install -g pm2
    sudo su -c "env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi"
    pm2 start ~/SmartAlarmPi/installers/pm2_SmartAlarmPi.json
    pm2 save
fi

echo " "
echo -e "\e[92mWe're ready! Run \e[1m\e[97mDISPLAY=:0 npm start\e[0m\e[92m from the ~/SmartAlarmPi directory to start your SmartAlarmPi.\e[0m"
echo " "
echo " "
