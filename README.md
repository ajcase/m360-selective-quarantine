# Selective-Quarantine for MaaS360
A node.js program to selectively target groups for compliance enforcement and block their access to email if not enrolled. With support for multiple devices, this app is the simplest way to enforce compliance during a staged roll out of the MaaS360 product.

# Components
- node.js
  - logger
  - xml2js
  - express
  - request
- MaaS360 API (see more at https://maas360apidocs.mybluemix.net)

# Set Up
1. Open `src/app.js` and configure your API information on line 22-28. Be sure to remove the brackets.
2. Set the group name variable on line 32. This must match with the group name in MaaS360. You must have this group added as a "managed user group" in order for the API to know.

# Default Logic
The app detects both primary mailboxes and secondary mailboxes based on the device record. If the device record's ActiveSync agent ID starts with `mdmxx..` then the device is MaaS360 managed and enrolled. In the inverse scenario, we detect the ownership and if they are blocked, we unblock them, and if they are not blocked, we do nothing.

### Who will be blocked?
1. Devices that are not enrolled in MaaS360
2. Devices that are enrolled but using Native Mail on their Personal Devices.

### Who will be approved?
1. Devices that are enrolled in MaaS360 and Corporate owned using secure mail or native mail.
2. Devices that are blocked but shouldn't be, such as secure mail clients.

### Output
I intended this app to be run on a cycle. The script will output a CSV and a log file in `logs/` directory with the timestamp of the run. You can configure this directory on line 11 and 12.

Example CSV:
```csv
User,Device ID,Mailbox ID,Current Status,Action Status
user1@domain.com,ApplF17SXX16HG7J,[multiple],Exempt
user1@domain.com,ApplF19XX6F8G5MG,PTI63SU8MT38GHDD13CVI97018,Blocked
```
Example Log:
```text
[10:49:24 GMT-0600 (CST)] -- Starting Script --
[10:49:24 GMT-0600 (CST)] Status File Location: results-2017-12-14T164924.csv
[10:49:24 GMT-0600 (CST)] Log File Location: log-2017-12-14T164924.log
[10:49:24 GMT-0600 (CST)] Starting Authentication to MaaS360
[10:49:24 GMT-0600 (CST)] URL for Authentication is: https://services.m3.maas360.com/auth-apis/auth/1.0/authenticate/30000000
[10:49:24 GMT-0600 (CST)] Response from MaaS360 API: 200
[10:49:24 GMT-0600 (CST)] Authentication Successful to MaaS360 API
[10:49:25 GMT-0600 (CST)] Performed call to get all groups in existence
[10:49:25 GMT-0600 (CST)] [Staging] Found Group MaaS360_Enabled_Users with Group ID 549624X
[10:49:25 GMT-0600 (CST)] Processing all users from page undefined from the API of users
[10:49:26 GMT-0600 (CST)] Performed call to get all users within group MaaS360_Enabled_Users
[10:49:26 GMT-0600 (CST)] There are 5 users total. We'll need to run the API 1 times
[10:49:26 GMT-0600 (CST)] Processing all users from page 1 from the API of users
[10:49:26 GMT-0600 (CST)] [user1@domain.com] This user has 6 devices.
[10:49:26 GMT-0600 (CST)] [user1@domain.com] Device properties set, processing MaaS360 Device ID: ApplF17SXX16HG7J
[10:49:26 GMT-0600 (CST)] [user1@domain.com] Check if Device ID: ApplF17SXX16HG7J has multiple Devices: true
[10:49:26 GMT-0600 (CST)] [user1@domain.com] Device ID: ApplF17SXX16HG7J processing both mailbox IDs
[10:49:26 GMT-0600 (CST)] [user1@domain.com] User has multiple mail accounts but device is corporate owned, moving on.
```
