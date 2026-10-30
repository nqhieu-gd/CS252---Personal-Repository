* Panda carries all of Python's indexing abilities over.
* You can call an item's property as an attribute

&#x20;   Ex: data.prop, data\['prop'], data\['prop']\[num]

* data\_name.iloc\[index\_num\_1, index\_num\_2] to quick access row at index\_num\_1 and column at index\_num\_2.
* num\_1:num\_2 indicates a range from num\_1 to num\_2.
* We can also access an data property via data.iloc\[\[index\_num\_1:index\_num\_2], \[index\_num\_3, index\_num\_4, index\_num\_5...]].
* Using negative num will count from the last row/column toward the first.
* data\_name.loc\[row\_index\_nums, column\_list] to quick access rows at row\_index\_nums and columns at column\_list.
* iloc consider n1:n2 from n1 to n2 - 1, loc consider n1:n2 from n1 to n2. Otherwise the same.
* data\_name.set\_index("id\_name") to set an index that might be better than the current ones.
* data\_name.prop == prop\_instant return a table that check where the each data has prop that is prop\_instant
* data\_name.loc\[data\_name.prop == prop\_instant] access only data that is true to the condition.
* The logic inside can be complex too.
* data\_name.prop.isin(data\_prop\_list) check if a data has prop that is among the data\_prop\_list.
* data\_name.prop.notnull() check if the data has prop that is not null (empty).
* data\_name\[new\_prop] = prop\_data will assign a new data to that dataframe, each data will have the corresponding position in the prop\_data (const or a list or an iteration).

