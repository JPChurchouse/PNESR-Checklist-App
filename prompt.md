Generate a web application for the administrative tasks of a miniature ride-on train. There are two paper systems that need to be replaced: pre-operation safety check, and the ticket office form.

# Fleet
During normal operation, between one and three trains are running, each with up to six carriages as discussed later.
## Locmotives
There are currently four locomotives in the fleet. Each locomotive has a unique ID, and year of manufacture. For reference purposes only, each locomotive has a note for its fuel type and its livery. A reference photo will be available for each locomotive. 
There will also be a section for notes such as special operating conditions. There is also a status for each loco declaring wether each loco is in service.
| ID  | Year | Livery   | Fuel   |
| --- | ---- | -------- | ------ |
| DA  | 1969 | Red      | Diesel |
| DXC | 1975 | Kiwirail | Diesel |
| DXR | 1997 | Kiwirail | Diesel |
| DG  | 2024 | Burgandy | Diesel |
Livery names will be changed later - ensure those are easily editable.
## Carriages
While there are other carriages for maintainance and other work, they are not subject to the checks this application is recording and will be omitted. The carriages mentioned in this description will refer to the passenger carrying type. There will also be a reference photo available for each carriage.
| ID | Speacialty | Livery |
| -- | ---------- | ------ |
| A  | Crew Only  | Work Train |
| B  |            | Capital Connection |
| C  | Driver     | Capital Connection |
| D  |            | Capital Connection |
| E  | Driver     | Autism NZ |
| F  |            | Manawatu Turbos |
| G  |            | Wildbase Recovery |
| H  | Guard      | Scouts NZ|
| I  | Guard      | Capital Connection |
| J  | Driver     | Lions Club |
| K  |            | Capital Connection |
| L  | Guard      | Orange |
| M  |            | Capital Connection |
| N  |            | Freemasons NZ |
| O  |            | Emergency Services |
| P  |            | Central Energy Trust |
| Q  | Wheelchair | Kind Hearts Movement |
| R  |            | Esplanade Scenic Railway |
| S  |            | Cadet Forces |
Livery names may be changed later - ensure those are easily editable.
### Carriage Sets
A Carriage Set comprises a Driver carriage, a Guard carriage, and up to four standard carriages between for a total maximum of six. As the names suggest, the first carriage is the one the driver sits on (facing forward to access the controls of the locomotive), and the rear carriage is where the guard sits (to oversee the safety compliance of the passengers). Technically, the minimum train length may be two carriages (a driver one and a guard one), and legally the longest train length is six carriages (driver, four standard, guard). Here are the default sets, noting that they may be changed (which the app should account for):
| Name | 1 | 2 | 3 | 4 | 5 | 6 |
| ---- | - | - | - | - | - | - |
| CC   | C | B | D | K | M | I |
| 2    | E | F | G | N | O | H |
| 3    | J | P | R | S | Q | L |
Set names will be changed later - ensure those are easily editable.
# Pre-operation Safety Check
Prior to accepting passengers, the following checks must be completed:
## Track
1. A complete track run around with a train to verify the track is in working order.
2. Deploy operating signage and verify crossing alarms are operational
3. Radio checks.
## Locomotives
Each locomotive needs the following to be checked:
1. Sufficient fuel.
2. Horn operation.
3. Lights operation.
## Carriages
Each carriage must be checked for the following:
1. Doors opening and latching correctly.
2. Mechanical and electrical connections to locomotive/carriage in front are secure.
### Driver Carriages
Driver carriages also need the following:
1. Fire extinguisher is present.
### Guard Carriages
Guard carriages also need the following:
1. Fire extinguisher is present.
2. Tail lights operating correctly
3. Signal button operating correctly.
4. First aid kit present.
## Export PDF
The notes as described above need to be exported as a PDF with the date and time of completion clearly noted, as well as the name/signature of the shift manager.

# Ticket Sales Sheet
There are two stations, Victoria Station and Playground Station, each with a ticket office. Passengers purchase tickets from the office and queue on the platform to get onto a train.
## Tickets
There are four types of tickets available, each station has these same value tickets but in a different colour to differentiate where they were purchased. Each ticket also has a unique consecutive serial number which is used to calculate how many were sold during the shift (end number minus start number). The start number for each ticket type needs to be recorded before tickets are sold, and the final ticket number remaining needs to be recorded which can be used to calculate the number of them sold, and by extension, how much money should have been taken to purchase them all.
| Ticket     | Cost | Victoria Station | Playground Station | Note |
| ---------- | ---- | ---------------- | ------------------ | ---- |
| One-way    |   $2 | Black            | White              | Half circuit (one direction) |
| Return     |   $3 | Blue             | Orange             | Full circuit (return to starting station) |
| Supporter  |   $0 | Purple           | Purple             | Return but for people meeting special criteria* |
| Concession |  $20 | Red              | Red                | Eight Return trips (discounted) |
*Some people may meet the "free ride" criteria:
* People with disabilities (when riding with a paying passenger)
* Family members of staff (when riding with said staff member)
* Mothers/Fathers on Mothers/Fathers day respectively (with a paying passenger)
## Float
Before the shift and after the count up, the float must be checked. The float comprises:
| Denomination | Quantity / Bag | # Bags | Total |
| --- | -- | - | ---- |
|  $1 | 10 | 3 |  $30 |
|  $2 | 10 | 4 |  $80 |
|  $5 | 12 | 1 |  $60 |
| $10 |  8 | 1 |  $80 |
|     |    |   | $250 |
## Takings
At the end of the shift, any excess cash is called takings and needs to be quantified. For clarity, here are the denominations available in the NZ currency system:
| Type  | Denominations |
| ----- | ------------- |
| Coins | $0.10, $0.20, $0.50, $1, $2 |
| Notes | $5, $10, $20, $50, $100 |
At the end of shift, the cashier will firstly reset the float, then count the quantity of each cash denomination which the app will then tally up. Also note there is the EFTPOS takings (which also includes a surcharge ammount but this is just recorded and not factored into calculations). A photo of the total takings receipt from the EFTPOS machine should be taken and recorded too if able. People often make donations too via both cash and EFTPOS, so that needs to be taken into account too.
## Final Calculations
At the end of the shift, the total count of each type of ticket sold are used to calculate the total dollar value of the tickets sold. The takings are then compared to check if the value of tickets sold equals the value of money taken, and if not, which way the discrepincy is. All of this needs to be explicitly noted on the export PDF for the shift. There needs to be a seperate exported PDF for each station.